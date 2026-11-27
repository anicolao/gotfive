import type { GameInfo, PlayerProfile } from '../store/lobbySlice';

export const STALE_PUBLIC_GAME_AGE_MILLIS = 2 * 60 * 60 * 1000;

export interface EventTimestamp {
	seconds: number;
	nanoseconds: number;
	toMillis(): number;
}

export interface EventCursor {
	createdAtMillis: number;
	createdAtSeconds: number;
	createdAtNanoseconds: number;
	documentId: string;
}

export interface OrderedEvent<TPayload = any> {
	id: string;
	type: string;
	payload: TPayload;
	actorUid: string;
	createdAt: EventTimestamp;
	schemaVersion: number;
	reducerVersion: number;
}

export interface UserRecord {
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

export interface LobbyGameProjection {
	gameId: string;
	hostUid: string;
	name: string;
	visibility: 'public' | 'hidden';
	maxPlayers: number;
	createdAtMillis: number;
	status: 'open' | 'playing';
	roster: string[];
}

export interface LobbyAccumulator {
	playerUids: string[];
	games: Record<string, LobbyGameProjection>;
	closedGames: string[];
}

export type GameBatchStep =
	| { kind: 'event'; event: OrderedEvent }
	| { kind: 'resetUI' };

export interface GameBatchPlan {
	clearPlayersFirst: boolean;
	steps: GameBatchStep[];
	nextGameStartEventId: string | null;
}

export function cursorFor(event: Pick<OrderedEvent, 'createdAt' | 'id'>): EventCursor {
	return {
		createdAtMillis: event.createdAt.toMillis(),
		createdAtSeconds: event.createdAt.seconds,
		createdAtNanoseconds: event.createdAt.nanoseconds,
		documentId: event.id
	};
}

export function compareEvents(
	a: Pick<OrderedEvent, 'createdAt' | 'id'>,
	b: Pick<OrderedEvent, 'createdAt' | 'id'>
): number {
	if (a.createdAt.seconds !== b.createdAt.seconds) {
		return a.createdAt.seconds - b.createdAt.seconds;
	}
	if (a.createdAt.nanoseconds !== b.createdAt.nanoseconds) {
		return a.createdAt.nanoseconds - b.createdAt.nanoseconds;
	}
	return a.id.localeCompare(b.id);
}

export function compareEventToCursor(
	event: Pick<OrderedEvent, 'createdAt' | 'id'>,
	cursor: EventCursor
): number {
	if (event.createdAt.seconds !== cursor.createdAtSeconds) {
		return event.createdAt.seconds - cursor.createdAtSeconds;
	}
	if (event.createdAt.nanoseconds !== cursor.createdAtNanoseconds) {
		return event.createdAt.nanoseconds - cursor.createdAtNanoseconds;
	}
	return event.id.localeCompare(cursor.documentId);
}

export function maxCursor(current: EventCursor | null, candidate: EventCursor): EventCursor {
	if (!current) return candidate;
	if (candidate.createdAtSeconds !== current.createdAtSeconds) {
		return candidate.createdAtSeconds > current.createdAtSeconds ? candidate : current;
	}
	if (candidate.createdAtNanoseconds !== current.createdAtNanoseconds) {
		return candidate.createdAtNanoseconds > current.createdAtNanoseconds ? candidate : current;
	}
	return candidate.documentId.localeCompare(current.documentId) > 0 ? candidate : current;
}

export function emptyLobbyAccumulator(): LobbyAccumulator {
	return {
		playerUids: [],
		games: {},
		closedGames: []
	};
}

export function cloneLobbyAccumulator(acc: LobbyAccumulator): LobbyAccumulator {
	const games: Record<string, LobbyGameProjection> = {};
	for (const [gameId, game] of Object.entries(acc.games)) {
		games[gameId] = { ...game, roster: [...game.roster] };
	}
	return {
		playerUids: [...acc.playerUids],
		games,
		closedGames: [...acc.closedGames]
	};
}

export function applyLobbyEvent(
	acc: LobbyAccumulator,
	event: OrderedEvent,
	lobbyId: string
): boolean {
	const payload = event.payload || {};
	if ((payload.lobbyId || 'default') !== lobbyId) return false;

	switch (event.type) {
		case 'lobby/join': {
			const uid: string = payload.uid || event.actorUid;
			if (!acc.playerUids.includes(uid)) {
				acc.playerUids.push(uid);
			}
			return true;
		}
		case 'lobby/leave': {
			const uid: string = payload.uid || event.actorUid;
			const index = acc.playerUids.indexOf(uid);
			if (index !== -1) acc.playerUids.splice(index, 1);
			return true;
		}
		case 'lobby/createGame': {
			const gameId: string = payload.gameId;
			if (!gameId || acc.closedGames.includes(gameId)) return false;
			acc.games[gameId] = {
				gameId,
				hostUid: event.actorUid,
				name: payload.name,
				visibility: payload.visibility,
				maxPlayers: payload.maxPlayers,
				createdAtMillis: event.createdAt.toMillis(),
				status: 'open',
				roster: [event.actorUid]
			};
			return true;
		}
		case 'lobby/updateGame': {
			const game = acc.games[payload.gameId];
			if (!game) return false;
			if (payload.name !== undefined) game.name = payload.name;
			if (payload.visibility !== undefined) game.visibility = payload.visibility;
			if (payload.maxPlayers !== undefined) game.maxPlayers = payload.maxPlayers;
			return true;
		}
		case 'lobby/joinGame': {
			const game = acc.games[payload.gameId];
			if (!game || game.status !== 'open') return false;
			const uid: string = payload.uid || event.actorUid;
			if (!game.roster.includes(uid)) {
				game.roster.push(uid);
			}
			return true;
		}
		case 'lobby/leaveGame': {
			const game = acc.games[payload.gameId];
			if (!game) return false;
			const uid: string = payload.uid || event.actorUid;
			const index = game.roster.indexOf(uid);
			if (index !== -1) game.roster.splice(index, 1);
			return true;
		}
		case 'lobby/startGame': {
			const game = acc.games[payload.gameId];
			if (!game) return false;
			game.status = 'playing';
			return true;
		}
		case 'lobby/closeGame': {
			const gameId: string = payload.gameId;
			if (!gameId) return false;
			if (!acc.closedGames.includes(gameId)) {
				acc.closedGames.push(gameId);
			}
			delete acc.games[gameId];
			return true;
		}
		default:
			return false;
	}
}

export function resolveUserProfile(
	userRecords: Map<string, UserRecord>,
	uid: string
): UserRecord {
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

export function deriveLobbyView(
	acc: LobbyAccumulator,
	userRecords: Map<string, UserRecord>,
	now = Date.now(),
	staleAgeMillis = STALE_PUBLIC_GAME_AGE_MILLIS
): { players: Record<string, PlayerProfile>; publicGames: Record<string, GameInfo> } {
	const players: Record<string, PlayerProfile> = {};
	for (const uid of acc.playerUids) {
		const user = resolveUserProfile(userRecords, uid);
		players[uid] = {
			id: uid,
			name: user.displayName,
			avatar: user.avatar,
			status: user.visibility,
			activity: user.activeGameId ? 'playing' : 'idle',
			lastSeen: user.lastSeenAt
		};
	}

	const publicGames: Record<string, GameInfo> = {};
	for (const game of Object.values(acc.games)) {
		if (game.status !== 'open') continue;
		if (game.createdAtMillis && now - game.createdAtMillis > staleAgeMillis) continue;
		const host = resolveUserProfile(userRecords, game.hostUid);
		publicGames[game.gameId] = {
			hostId: game.gameId,
			hostName: host.displayName,
			name: game.name,
			visibility: game.visibility,
			playerCount: game.roster.length,
			maxPlayers: game.maxPlayers,
			createdAtMillis: game.createdAtMillis
		};
	}

	return { players, publicGames };
}

export function planGameBatch(
	sortedEvents: OrderedEvent[],
	currentGameStartEventId: string | null
): GameBatchPlan {
	let firstStartIndex = -1;
	let latestStartIndex = -1;
	for (let i = 0; i < sortedEvents.length; i += 1) {
		if (sortedEvents[i].type === 'game/start') {
			if (firstStartIndex === -1) firstStartIndex = i;
			latestStartIndex = i;
		}
	}

	let startSliceIndex = 0;
	let clearPlayersFirst = false;
	const isLiveRematch =
		latestStartIndex !== -1
		&& currentGameStartEventId !== null
		&& sortedEvents[latestStartIndex].id !== currentGameStartEventId;
	const hasMultipleStarts = firstStartIndex !== -1 && firstStartIndex !== latestStartIndex;

	if (hasMultipleStarts || isLiveRematch) {
		let roundBegin = latestStartIndex;
		while (roundBegin > 0) {
			const prevType = sortedEvents[roundBegin - 1].type;
			if (prevType === 'players/addPlayer' || prevType === 'players/setHand') {
				roundBegin -= 1;
			} else {
				break;
			}
		}
		startSliceIndex = roundBegin;
		if (isLiveRematch) {
			clearPlayersFirst = sortedEvents
				.slice(startSliceIndex, latestStartIndex)
				.some((event) => event.type === 'players/addPlayer');
		}
	}

	const steps: GameBatchStep[] = [];
	for (let i = startSliceIndex; i < sortedEvents.length; i += 1) {
		const event = sortedEvents[i];
		// Skip deduction sheet UI events from before the latest round started.
		if (latestStartIndex !== -1 && i < latestStartIndex && event.type.startsWith('ui/')) {
			continue;
		}
		steps.push({ kind: 'event', event });
		if (i === latestStartIndex && isLiveRematch) {
			steps.push({ kind: 'resetUI' });
		}
	}

	return {
		clearPlayersFirst,
		steps,
		nextGameStartEventId: latestStartIndex !== -1 ? sortedEvents[latestStartIndex].id : currentGameStartEventId
	};
}
