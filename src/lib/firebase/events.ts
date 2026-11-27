import {
	collection,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	doc,
	writeBatch,
	Timestamp,
	type Firestore,
	type QueryDocumentSnapshot,
	type Unsubscribe,
	where,
	limit
} from 'firebase/firestore';
import {
	GoogleAuthProvider,
	linkWithPopup,
	onAuthStateChanged,
	signInWithCustomToken,
	signInAnonymously,
	signOut,
	type User
} from 'firebase/auth';
import { getFirebase } from './config';
import {
	applyLobbyEvent,
	cloneLobbyAccumulator,
	compareEvents,
	compareEventToCursor,
	cursorFor,
	deriveLobbyView,
	emptyLobbyAccumulator,
	maxCursor,
	planGameBatch,
	resolveUserProfile,
	type EventCursor,
	type LobbyAccumulator,
	type OrderedEvent,
	type UserRecord
} from './projection';
import { setLobbyState, setMyStatus } from '$lib/store/lobbySlice';
import { sync as syncGame, resetGame } from '$lib/store/gameSlice';
import { syncPlayers, resetPlayers, clearPlayers } from '$lib/store/playersSlice';
import { resetUI, setGameId, setIsHost, setMyId, syncUI } from '$lib/store/uiSlice';
import { store, type AppDispatch, type RootState } from '$lib/store';

export const LOBBY_REDUCER_VERSION = 2;
export const GAME_REDUCER_VERSION = 2;

export type { EventCursor, UserRecord };

export interface FirebaseEvent<TPayload = any> {
	type: string;
	payload: TPayload;
	actorUid: string;
	createdAt: Timestamp;
	schemaVersion: number;
	reducerVersion: number;
}

interface CachedProjection<T> {
	reducerVersion: number;
	cursor: EventCursor | null;
	state: T;
}

interface CachedGameState {
	game: RootState['game'];
	players: RootState['players'];
	ui: {
		deductionBoard: RootState['ui']['deductionBoard'];
		guessInputs: RootState['ui']['guessInputs'];
	};
	startEventId: string | null;
}

const EVENT_SCHEMA_VERSION = 1;
let currentUser: User | null = null;
let userRecords = new Map<string, UserRecord>();
let lobbyAccumulator: LobbyAccumulator = emptyLobbyAccumulator();
let lobbyUnsubscribe: Unsubscribe | null = null;
let usersUnsubscribe: Unsubscribe | null = null;
let gameUnsubscribe: Unsubscribe | null = null;
let currentLobbyId = 'default';
let eventDocumentCounter = 0;

type EventWithId = FirebaseEvent & { id: string };

function getTestUid() {
	if (typeof window === 'undefined' || import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true') return null;
	return new URLSearchParams(window.location.search).get('myId');
}

function unsignedEmulatorCustomToken(uid: string) {
	const now = Math.floor(Date.now() / 1000);
	const encode = (value: unknown) => {
		const json = JSON.stringify(value);
		return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	};

	return [
		encode({ alg: 'none', typ: 'JWT' }),
		encode({
			aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
			iat: now,
			exp: now + 3600,
			iss: 'firebase-auth-emulator@example.test',
			sub: 'firebase-auth-emulator@example.test',
			uid
		}),
		''
	].join('.');
}

function eventFromDoc(snapshot: QueryDocumentSnapshot): EventWithId | null {
	const data = snapshot.data() as FirebaseEvent;
	if (!data.createdAt) return null;
	return { ...data, id: snapshot.id };
}

function cursorToTimestamp(cursor: EventCursor): Timestamp {
	return new Timestamp(cursor.createdAtSeconds, cursor.createdAtNanoseconds);
}

function nextEventDocumentId(target: ReturnType<typeof collection>) {
	eventDocumentCounter += 1;
	const millis = Date.now().toString(36).padStart(10, '0');
	const sequence = eventDocumentCounter.toString(36).padStart(4, '0');
	return `${millis}-${sequence}-${doc(target).id}`;
}

function cacheKey(stream: string) {
	return `gotfive:event-cache:${stream}`;
}

function loadCache<T>(stream: string, reducerVersion: number): CachedProjection<T> | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(cacheKey(stream));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as CachedProjection<T>;
		if (parsed.reducerVersion !== reducerVersion) return null;
		if (
			parsed.cursor !== null
			&& (typeof parsed.cursor.createdAtSeconds !== 'number'
				|| typeof parsed.cursor.createdAtNanoseconds !== 'number'
				|| typeof parsed.cursor.documentId !== 'string')
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function saveCache<T>(stream: string, projection: CachedProjection<T>) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(cacheKey(stream), JSON.stringify(projection));
}

async function ensureAuth(): Promise<User> {
	const { auth } = getFirebase();
	const testUid = getTestUid();
	if (testUid && auth.currentUser?.uid !== testUid) {
		if (auth.currentUser) await signOut(auth);
		const result = await signInWithCustomToken(auth, unsignedEmulatorCustomToken(testUid));
		currentUser = result.user;
		return result.user;
	}

	if (auth.currentUser) {
		currentUser = auth.currentUser;
		return auth.currentUser;
	}

	return await new Promise((resolve, reject) => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			unsubscribe();
			try {
				if (user) {
					if (testUid && user.uid !== testUid) {
						await signOut(auth);
						const result = await signInWithCustomToken(auth, unsignedEmulatorCustomToken(testUid));
						currentUser = result.user;
						resolve(result.user);
						return;
					}
					currentUser = user;
					resolve(user);
				} else {
					if (testUid) {
						const result = await signInWithCustomToken(auth, unsignedEmulatorCustomToken(testUid));
						currentUser = result.user;
						resolve(result.user);
						return;
					}
					const result = await signInAnonymously(auth);
					currentUser = result.user;
					resolve(result.user);
				}
			} catch (error) {
				reject(error);
			}
		});
	});
}

export async function initializeFirebaseProfile(name: string, avatar: string, visibility: 'visible' | 'lurking') {
	const user = await ensureAuth();
	const { db } = getFirebase();
	const record: UserRecord = {
		uid: user.uid,
		displayName: name,
		avatar,
		visibility,
		presence: 'online',
		activeGameId: null,
		isAnonymous: user.isAnonymous,
		googleLinked: user.providerData.some((provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID),
		googleEmail: user.email,
		lastSeenAt: Date.now()
	};
	await setDoc(doc(db, 'users', user.uid), {
		...record,
		updatedAt: serverTimestamp()
	}, { merge: true });
	return record;
}

export async function linkCurrentUserWithGoogle() {
	const user = await ensureAuth();
	const provider = new GoogleAuthProvider();
	await linkWithPopup(user, provider);
	const refreshed = getFirebase().auth.currentUser;
	if (!refreshed) return;
	await setDoc(doc(getFirebase().db, 'users', refreshed.uid), {
		isAnonymous: refreshed.isAnonymous,
		googleLinked: true,
		googleEmail: refreshed.email,
		updatedAt: serverTimestamp()
	}, { merge: true });
}

export async function updateUserVisibility(visibility: 'visible' | 'lurking') {
	const user = await ensureAuth();
	await setDoc(doc(getFirebase().db, 'users', user.uid), {
		visibility,
		presence: 'online',
		lastSeenAt: Date.now(),
		updatedAt: serverTimestamp()
	}, { merge: true });
}

export async function updateUserPresence(activeGameId: string | null) {
	const user = await ensureAuth();
	await setDoc(doc(getFirebase().db, 'users', user.uid), {
		presence: 'online',
		activeGameId,
		lastSeenAt: Date.now(),
		updatedAt: serverTimestamp()
	}, { merge: true });
}

async function writeEvent(db: Firestore, path: string[], type: string, payload: any) {
	const user = await ensureAuth();
	const target = path.length === 1
		? collection(db, path[0])
		: collection(db, path[0], path[1], path[2]);
	await setDoc(doc(target, nextEventDocumentId(target)), {
		type,
		payload: payload ?? null,
		actorUid: user.uid,
		createdAt: serverTimestamp(),
		schemaVersion: EVENT_SCHEMA_VERSION,
		reducerVersion: path[0] === 'lobby' ? LOBBY_REDUCER_VERSION : GAME_REDUCER_VERSION
	});
}

export async function writeLobbyEvent(type: string, payload: any) {
	await writeEvent(getFirebase().db, ['lobby'], type, { ...payload, lobbyId: currentLobbyId });
}

export async function writeGameEvent(gameId: string, type: string, payload: any) {
	await writeEvent(getFirebase().db, ['games', gameId, 'actions'], type, payload);
}

export async function writeGameEvents(gameId: string, events: Array<{ type: string; payload: any }>) {
	if (events.length === 0) return;

	const user = await ensureAuth();
	const db = getFirebase().db;
	const target = collection(db, 'games', gameId, 'actions');
	const batch = writeBatch(db);

	for (const event of events) {
		batch.set(doc(target, nextEventDocumentId(target)), {
			type: event.type,
			payload: event.payload ?? null,
			actorUid: user.uid,
			createdAt: serverTimestamp(),
			schemaVersion: EVENT_SCHEMA_VERSION,
			reducerVersion: GAME_REDUCER_VERSION
		});
	}

	await batch.commit();
}

export async function lobbyGameCodeExists(gameId: string) {
	const snapshot = await getDocs(query(
		collection(getFirebase().db, 'lobby'),
		where('payload.gameId', '==', gameId),
		limit(1)
	));
	return snapshot.docs.some((docSnap) => {
		const event = docSnap.data() as FirebaseEvent;
		return event.type === 'lobby/createGame';
	});
}

function dispatchLobbyView(dispatch: AppDispatch) {
	dispatch(setLobbyState(deriveLobbyView(lobbyAccumulator, userRecords)));
}

export async function subscribeLobby(dispatch: AppDispatch) {
	const user = await ensureAuth();
	if (typeof window !== 'undefined') {
		currentLobbyId = new URLSearchParams(window.location.search).get('lobbyId') || 'default';
	}
	dispatch(setMyStatus('CONNECTING'));
	usersUnsubscribe?.();
	lobbyUnsubscribe?.();

	const streamKey = `lobby:${currentLobbyId}`;
	const cached = loadCache<LobbyAccumulator>(streamKey, LOBBY_REDUCER_VERSION);
	const initialCursor = cached?.cursor ?? null;
	let latestCursor: EventCursor | null = initialCursor;
	const appliedEventIds = new Set<string>();

	lobbyAccumulator = cached ? cloneLobbyAccumulator(cached.state) : emptyLobbyAccumulator();
	if (cached) {
		dispatchLobbyView(dispatch);
	}

	usersUnsubscribe = onSnapshot(
		collection(getFirebase().db, 'users'),
		(snapshot) => {
			for (const change of snapshot.docChanges()) {
				if (change.type === 'removed') {
					userRecords.delete(change.doc.id);
				} else {
					userRecords.set(change.doc.id, change.doc.data() as UserRecord);
				}
			}
			dispatchLobbyView(dispatch);
		},
		(error) => {
			console.error('Firebase users subscription failed', error);
			dispatch(setMyStatus('OFFLINE'));
		}
	);

	const lobbyCollection = collection(getFirebase().db, 'lobby');
	const lobbyQuery = initialCursor
		? query(
			lobbyCollection,
			where('createdAt', '>=', cursorToTimestamp(initialCursor)),
			orderBy('createdAt')
		)
		: query(lobbyCollection, orderBy('createdAt'));

	lobbyUnsubscribe = onSnapshot(
		lobbyQuery,
		{ includeMetadataChanges: true },
		(snapshot) => {
			const newEvents: EventWithId[] = [];
			for (const change of snapshot.docChanges({ includeMetadataChanges: true })) {
				if (change.type !== 'added' && change.type !== 'modified') continue;
				const event = eventFromDoc(change.doc);
				if (!event || appliedEventIds.has(event.id)) continue;
				if (initialCursor && compareEventToCursor(event, initialCursor) <= 0) {
					appliedEventIds.add(event.id);
					continue;
				}
				newEvents.push(event);
			}

			if (newEvents.length > 0) {
				newEvents.sort(compareEvents);
				for (const event of newEvents) {
					appliedEventIds.add(event.id);
					latestCursor = maxCursor(latestCursor, cursorFor(event));
					applyLobbyEvent(lobbyAccumulator, event, currentLobbyId);
				}
				dispatchLobbyView(dispatch);
				saveCache(streamKey, {
					reducerVersion: LOBBY_REDUCER_VERSION,
					cursor: latestCursor,
					state: cloneLobbyAccumulator(lobbyAccumulator)
				});
			}

			dispatch(setMyStatus('LOBBY_CLIENT'));
		},
		(error) => {
			console.error('Firebase lobby subscription failed', error);
			dispatch(setMyStatus('OFFLINE'));
		}
	);

	await writeLobbyEvent('lobby/join', { uid: user.uid });
}

export function unsubscribeLobby() {
	lobbyUnsubscribe?.();
	usersUnsubscribe?.();
	lobbyUnsubscribe = null;
	usersUnsubscribe = null;
}

export function getLobbyRoster(gameId: string) {
	return [...(lobbyAccumulator.games[gameId]?.roster ?? [])];
}

export function getUserDisplay(uid: string) {
	const user = resolveUserProfile(userRecords, uid);
	return { name: user.displayName, avatar: user.avatar };
}

export async function subscribeGame(gameId: string, dispatch: AppDispatch) {
	gameUnsubscribe?.();
	const user = await ensureAuth();
	dispatch(resetPlayers());
	dispatch(resetGame());
	dispatch(resetUI());
	dispatch(setGameId(gameId));
	await updateUserPresence(gameId);

	const streamKey = `game:${gameId}:${user.uid}`;
	const cached = loadCache<CachedGameState>(streamKey, GAME_REDUCER_VERSION);
	const initialCursor = cached?.cursor ?? null;
	let latestCursor: EventCursor | null = initialCursor;
	let currentGameStartEventId: string | null = cached?.state.startEventId ?? null;
	const appliedEventIds = new Set<string>();

	if (cached) {
		dispatch(syncPlayers(cached.state.players));
		dispatch(syncGame(cached.state.game));
		dispatch(syncUI(cached.state.ui));
	}

	const actionsCollection = collection(getFirebase().db, 'games', gameId, 'actions');
	const gameQuery = initialCursor
		? query(
			actionsCollection,
			where('createdAt', '>=', cursorToTimestamp(initialCursor)),
			orderBy('createdAt')
		)
		: query(actionsCollection, orderBy('createdAt'));

	gameUnsubscribe = onSnapshot(
		gameQuery,
		{ includeMetadataChanges: true },
		(snapshot) => {
			const newEvents: OrderedEvent[] = [];
			for (const change of snapshot.docChanges({ includeMetadataChanges: true })) {
				if (change.type !== 'added' && change.type !== 'modified') continue;
				const event = eventFromDoc(change.doc);
				if (!event || appliedEventIds.has(event.id)) continue;
				if (initialCursor && compareEventToCursor(event, initialCursor) <= 0) {
					appliedEventIds.add(event.id);
					continue;
				}
				newEvents.push(event);
			}

			if (newEvents.length === 0) return;

			newEvents.sort(compareEvents);
			for (const event of newEvents) {
				appliedEventIds.add(event.id);
				latestCursor = maxCursor(latestCursor, cursorFor(event));
			}

			const plan = planGameBatch(newEvents, currentGameStartEventId);
			if (plan.clearPlayersFirst) {
				dispatch(clearPlayers());
			}
			for (const step of plan.steps) {
				if (step.kind === 'resetUI') {
					dispatch(resetUI());
				} else {
					dispatch({ type: step.event.type, payload: step.event.payload, meta: { remote: true } });
				}
			}
			currentGameStartEventId = plan.nextGameStartEventId;

			const state = store.getState();
			saveCache<CachedGameState>(streamKey, {
				reducerVersion: GAME_REDUCER_VERSION,
				cursor: latestCursor,
				state: {
					game: state.game,
					players: state.players,
					ui: {
						deductionBoard: state.ui.deductionBoard,
						guessInputs: state.ui.guessInputs
					},
					startEventId: currentGameStartEventId
				}
			});
		},
		(error) => {
			console.error('Firebase game subscription failed', error);
		}
	);
}

export async function observeGame(gameId: string, dispatch: AppDispatch) {
	const user = await ensureAuth();
	dispatch(clearPlayers());
	dispatch(setMyId(user.uid));
	dispatch(setIsHost(false));
	await subscribeGame(gameId, dispatch);
}

export function unsubscribeGame() {
	gameUnsubscribe?.();
	gameUnsubscribe = null;
}

export async function hasRecentLobbyEvent(type: string, uid: string) {
	const snapshot = await getDocs(query(
		collection(getFirebase().db, 'lobby'),
		where('type', '==', type),
		where('actorUid', '==', uid),
		limit(1)
	));
	return !snapshot.empty;
}
