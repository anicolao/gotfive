import {
	collection,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	doc,
	type Firestore,
	type QueryDocumentSnapshot,
	type Timestamp,
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
import { setLobbyState, setMyStatus, setProfile, type GameInfo, type PlayerProfile } from '$lib/store/lobbySlice';
import { sync as syncGame, resetGame } from '$lib/store/gameSlice';
import { syncPlayers, resetPlayers } from '$lib/store/playersSlice';
import { resetUI, setGameId, setIsHost, setMyId } from '$lib/store/uiSlice';
import type { AppDispatch, RootState } from '$lib/store';

export const LOBBY_REDUCER_VERSION = 1;
export const GAME_REDUCER_VERSION = 1;

export interface EventCursor {
	createdAtMillis: number;
	documentId: string;
}

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

interface UserRecord {
	uid: string;
	displayName: string;
	avatar: string;
	visibility: 'visible' | 'lurking';
	presence: 'online' | 'idle' | 'offline';
	activeGameId?: string | null;
	isAnonymous: boolean;
	googleLinked: boolean;
	googleEmail?: string | null;
	lastSeenAt: number;
}

const EVENT_SCHEMA_VERSION = 1;
let currentUser: User | null = null;
let userRecords = new Map<string, UserRecord>();
let lobbyEvents: EventWithId[] = [];
let lobbyUnsubscribe: Unsubscribe | null = null;
let usersUnsubscribe: Unsubscribe | null = null;
let gameUnsubscribe: Unsubscribe | null = null;
let currentLobbyId = 'default';
let eventDocumentCounter = 0;
let currentGameStartEventId: string | null = null;

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

function compareEvents(a: EventWithId, b: EventWithId) {
	const createdDelta = a.createdAt.toMillis() - b.createdAt.toMillis();
	if (createdDelta !== 0) return createdDelta;
	return a.id.localeCompare(b.id);
}

function cursorFor(event: EventWithId): EventCursor {
	return {
		createdAtMillis: event.createdAt.toMillis(),
		documentId: event.id
	};
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
		return parsed.reducerVersion === reducerVersion ? parsed : null;
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
	for (let i = 0; i < events.length; i += 1) {
		await writeGameEvent(gameId, events[i].type, events[i].payload);
	}
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

function userProfile(uid: string): UserRecord {
	return userRecords.get(uid) || {
		uid,
		displayName: uid.slice(0, 8),
		avatar: 'default',
		visibility: 'visible',
		presence: 'offline',
		activeGameId: null,
		isAnonymous: true,
		googleLinked: false,
		lastSeenAt: 0
	};
}

function projectLobby(events: EventWithId[]) {
	const games = new Map<string, GameInfo & { status?: string; roster: Set<string> }>();
	const players = new Map<string, PlayerProfile>();
	const closedGames = new Set<string>();

	for (const event of [...events].sort(compareEvents)) {
		const payload = event.payload || {};
		if ((payload.lobbyId || 'default') !== currentLobbyId) continue;
		switch (event.type) {
			case 'lobby/join': {
				const uid = payload.uid || event.actorUid;
				const user = userProfile(uid);
				players.set(uid, {
					id: uid,
					name: user.displayName,
					avatar: user.avatar,
					status: user.visibility,
					activity: user.activeGameId ? 'playing' : 'idle',
					lastSeen: user.lastSeenAt
				});
				break;
			}
			case 'lobby/leave':
				players.delete(payload.uid || event.actorUid);
				break;
			case 'lobby/createGame': {
				if (closedGames.has(payload.gameId)) break;
				const host = userProfile(event.actorUid);
				games.set(payload.gameId, {
					hostId: payload.gameId,
					hostName: host.displayName,
					name: payload.name,
					visibility: payload.visibility,
					playerCount: 1,
					maxPlayers: payload.maxPlayers,
					status: 'open',
					roster: new Set([event.actorUid])
				});
				break;
			}
			case 'lobby/updateGame': {
				const game = games.get(payload.gameId);
				if (game) Object.assign(game, payload);
				break;
			}
			case 'lobby/joinGame': {
				const game = games.get(payload.gameId);
				if (game && game.status === 'open') {
					game.roster.add(payload.uid || event.actorUid);
					game.playerCount = game.roster.size;
				}
				break;
			}
			case 'lobby/leaveGame': {
				const game = games.get(payload.gameId);
				if (game && game.status === 'open') {
					game.roster.delete(payload.uid || event.actorUid);
					game.playerCount = game.roster.size;
				}
				break;
			}
			case 'lobby/startGame': {
				const game = games.get(payload.gameId);
				if (game) game.status = 'playing';
				break;
			}
			case 'lobby/closeGame':
				closedGames.add(payload.gameId);
				games.delete(payload.gameId);
				break;
		}
	}

	const publicGames: Record<string, GameInfo> = {};
	for (const [gameId, game] of games) {
		if (game.status === 'open') {
			publicGames[gameId] = {
				hostId: gameId,
				hostName: game.hostName,
				name: game.name,
				visibility: game.visibility,
				playerCount: game.playerCount,
				maxPlayers: game.maxPlayers
			};
		}
	}

	return {
		players: Object.fromEntries(players),
		publicGames
	};
}

function applyLobbyProjection(dispatch: AppDispatch) {
	const projection = projectLobby(lobbyEvents);
	dispatch(setLobbyState(projection));
	const last = [...lobbyEvents].sort(compareEvents).at(-1);
	saveCache(`lobby:${currentLobbyId}`, {
		reducerVersion: LOBBY_REDUCER_VERSION,
		cursor: last ? cursorFor(last) : null,
		state: projection
	});
}

export async function subscribeLobby(dispatch: AppDispatch) {
	const user = await ensureAuth();
	if (typeof window !== 'undefined') {
		currentLobbyId = new URLSearchParams(window.location.search).get('lobbyId') || 'default';
	}
	dispatch(setMyStatus('CONNECTING'));
	usersUnsubscribe?.();
	lobbyUnsubscribe?.();

	const cached = loadCache<ReturnType<typeof projectLobby>>(`lobby:${currentLobbyId}`, LOBBY_REDUCER_VERSION);
	if (cached) dispatch(setLobbyState(cached.state));

	usersUnsubscribe = onSnapshot(
		collection(getFirebase().db, 'users'),
		(snapshot) => {
			userRecords = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data() as UserRecord]));
			applyLobbyProjection(dispatch);
		},
		(error) => {
			console.error('Firebase users subscription failed', error);
			dispatch(setMyStatus('OFFLINE'));
		}
	);

	const lobbyQuery = query(collection(getFirebase().db, 'lobby'), orderBy('createdAt'));
	lobbyUnsubscribe = onSnapshot(
		lobbyQuery,
		(snapshot) => {
			lobbyEvents = snapshot.docs.map(eventFromDoc).filter((event): event is EventWithId => !!event);
			applyLobbyProjection(dispatch);
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
	const roster = new Set<string>();
	for (const event of [...lobbyEvents].sort(compareEvents)) {
		const payload = event.payload || {};
		if ((payload.lobbyId || 'default') !== currentLobbyId) continue;
		if (payload.gameId !== gameId) continue;
		if (event.type === 'lobby/createGame') roster.add(event.actorUid);
		if (event.type === 'lobby/joinGame') roster.add(payload.uid || event.actorUid);
		if (event.type === 'lobby/leaveGame') roster.delete(payload.uid || event.actorUid);
		if (event.type === 'lobby/closeGame') roster.clear();
	}
	return [...roster];
}

export function getUserDisplay(uid: string) {
	const user = userProfile(uid);
	return { name: user.displayName, avatar: user.avatar };
}

export async function subscribeGame(gameId: string, dispatch: AppDispatch) {
	gameUnsubscribe?.();
	currentGameStartEventId = null;
	dispatch(resetPlayers());
	dispatch(resetGame());
	dispatch(resetUI());
	dispatch(setGameId(gameId));
	await updateUserPresence(gameId);

	const cached = loadCache<{ game: RootState['game']; players: RootState['players'] }>(`game:${gameId}`, GAME_REDUCER_VERSION);
	if (cached) {
		dispatch(syncPlayers(cached.state.players));
		dispatch(syncGame(cached.state.game));
	}

	const gameQuery = query(collection(getFirebase().db, 'games', gameId, 'actions'), orderBy('createdAt'));
	gameUnsubscribe = onSnapshot(
		gameQuery,
		(snapshot) => {
			const events = snapshot.docs.map(eventFromDoc).filter((event): event is EventWithId => !!event).sort(compareEvents);
			if (events.length === 0) return;
			let latestStartEvent: EventWithId | null = null;
			for (let i = events.length - 1; i >= 0; i -= 1) {
				if (events[i].type === 'game/start') {
					latestStartEvent = events[i];
					break;
				}
			}
			const nextGameStartEventId = latestStartEvent?.id || null;
			const shouldResetLocalUI = !!currentGameStartEventId
				&& !!nextGameStartEventId
				&& currentGameStartEventId !== nextGameStartEventId;
			dispatch(resetPlayers());
			dispatch(resetGame());
			for (const event of events) {
				dispatch({ type: event.type, payload: event.payload, meta: { remote: true } });
			}
			if (shouldResetLocalUI) {
				dispatch(resetUI());
			}
			currentGameStartEventId = nextGameStartEventId;
			const last = events.at(-1);
			import('$lib/store').then(({ store }) => {
				const state = store.getState();
				saveCache(`game:${gameId}`, {
					reducerVersion: GAME_REDUCER_VERSION,
					cursor: last ? cursorFor(last) : null,
					state: { game: state.game, players: state.players }
				});
			});
		},
		(error) => {
			console.error('Firebase game subscription failed', error);
		}
	);
}

export async function observeGame(gameId: string, dispatch: AppDispatch) {
	const user = await ensureAuth();
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
