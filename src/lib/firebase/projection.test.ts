import { describe, expect, test } from 'bun:test';
import {
	applyLobbyEvent,
	compareEvents,
	compareEventToCursor,
	cursorFor,
	deriveLobbyView,
	emptyLobbyAccumulator,
	maxCursor,
	planGameBatch,
	type OrderedEvent,
	type UserRecord
} from './projection';

function makeTimestamp(seconds: number, nanoseconds = 0) {
	return {
		seconds,
		nanoseconds,
		toMillis: () => seconds * 1000 + Math.floor(nanoseconds / 1_000_000)
	};
}

function makeEvent(
	id: string,
	type: string,
	payload: unknown,
	seconds: number,
	nanoseconds = 0,
	actorUid = 'user-1'
): OrderedEvent {
	return {
		id,
		type,
		payload,
		actorUid,
		createdAt: makeTimestamp(seconds, nanoseconds),
		schemaVersion: 1,
		reducerVersion: 2
	};
}

describe('event cursor and ordering', () => {
	test('orders events by seconds, nanoseconds, then document id', () => {
		const a = makeEvent('002', 'game/reveal', 'Red', 100, 10);
		const b = makeEvent('001', 'game/reveal', 'Blue', 100, 10);
		const c = makeEvent('000', 'game/reveal', 'Green', 100, 20);
		const d = makeEvent('999', 'game/reveal', 'Yellow', 99, 999_999_999);

		const sorted = [a, b, c, d].sort(compareEvents);
		expect(sorted.map((e) => e.id)).toEqual(['999', '001', '002', '000']);
	});

	test('filters already-applied events at or before a cursor while preserving same-timestamp siblings', () => {
		const cursor = cursorFor(makeEvent('002', 'game/reveal', 'Red', 100, 500));

		expect(compareEventToCursor(makeEvent('001', 'game/reveal', 'Red', 100, 500), cursor)).toBeLessThan(0);
		expect(compareEventToCursor(makeEvent('002', 'game/reveal', 'Red', 100, 500), cursor)).toBe(0);
		expect(compareEventToCursor(makeEvent('003', 'game/reveal', 'Red', 100, 500), cursor)).toBeGreaterThan(0);
		expect(compareEventToCursor(makeEvent('000', 'game/reveal', 'Red', 100, 501), cursor)).toBeGreaterThan(0);

		const next = maxCursor(cursor, cursorFor(makeEvent('003', 'game/reveal', 'Red', 100, 500)));
		expect(next.documentId).toBe('003');
	});
});

describe('incremental lobby projection', () => {
	test('folds lobby events incrementally and derives public games and rosters', () => {
		const acc = emptyLobbyAccumulator();
		const users = new Map<string, UserRecord>([
			['host-1', {
				uid: 'host-1',
				displayName: 'Host',
				avatar: 'default',
				visibility: 'visible',
				presence: 'online',
				activeGameId: 'ABCDE',
				isAnonymous: true,
				googleLinked: false,
				lastSeenAt: 1000
			}],
			['guest-1', {
				uid: 'guest-1',
				displayName: 'Guest',
				avatar: 'default',
				visibility: 'visible',
				presence: 'online',
				activeGameId: null,
				isAnonymous: true,
				googleLinked: false,
				lastSeenAt: 2000
			}]
		]);

		applyLobbyEvent(acc, makeEvent('e1', 'lobby/join', { uid: 'host-1', lobbyId: 'l1' }, 10, 0, 'host-1'), 'l1');
		applyLobbyEvent(acc, makeEvent('e2', 'lobby/join', { uid: 'guest-1', lobbyId: 'l1' }, 11, 0, 'guest-1'), 'l1');
		applyLobbyEvent(acc, makeEvent('e3', 'lobby/join', { uid: 'other-1', lobbyId: 'l2' }, 12, 0, 'other-1'), 'l1');
		applyLobbyEvent(acc, makeEvent('e4', 'lobby/createGame', {
			gameId: 'ABCDE',
			name: "Host's Game",
			visibility: 'public',
			maxPlayers: 4,
			lobbyId: 'l1'
		}, 13, 0, 'host-1'), 'l1');
		applyLobbyEvent(acc, makeEvent('e5', 'lobby/joinGame', { gameId: 'ABCDE', uid: 'guest-1', lobbyId: 'l1' }, 14, 0, 'guest-1'), 'l1');

		const openView = deriveLobbyView(acc, users, 20_000);
		expect(Object.keys(openView.players)).toEqual(['host-1', 'guest-1']);
		expect(openView.players['host-1'].activity).toBe('playing');
		expect(openView.publicGames['ABCDE']).toEqual({
			hostId: 'ABCDE',
			hostName: 'Host',
			name: "Host's Game",
			visibility: 'public',
			playerCount: 2,
			maxPlayers: 4,
			createdAtMillis: 13_000
		});
		expect(acc.games['ABCDE'].roster).toEqual(['host-1', 'guest-1']);

		// Hides stale games past the 2-hour cutoff without replaying events.
		const staleView = deriveLobbyView(acc, users, 13_000 + 2 * 60 * 60 * 1000 + 1);
		expect(staleView.publicGames['ABCDE']).toBeUndefined();

		// Starting a game removes it from open publicGames while preserving roster.
		applyLobbyEvent(acc, makeEvent('e6', 'lobby/startGame', { gameId: 'ABCDE', lobbyId: 'l1' }, 15, 0, 'host-1'), 'l1');
		expect(deriveLobbyView(acc, users, 20_000).publicGames['ABCDE']).toBeUndefined();
		expect(acc.games['ABCDE'].roster).toEqual(['host-1', 'guest-1']);

		// Leaving removes the player from the roster.
		applyLobbyEvent(acc, makeEvent('e7', 'lobby/leaveGame', { gameId: 'ABCDE', uid: 'guest-1', lobbyId: 'l1' }, 16, 0, 'guest-1'), 'l1');
		expect(acc.games['ABCDE'].roster).toEqual(['host-1']);
	});
});

describe('incremental game batch planning', () => {
	test('applies normal incremental events directly without resetting players or UI', () => {
		const revealEvent = makeEvent('e10', 'game/reveal', 'Red', 50);
		const plan = planGameBatch([revealEvent], 'start-1');

		expect(plan.clearPlayersFirst).toBe(false);
		expect(plan.nextGameStartEventId).toBe('start-1');
		expect(plan.steps).toEqual([{ kind: 'event', event: revealEvent }]);
	});

	test('slices cold-start multi-round streams to the latest round and skips earlier UI events', () => {
		const events = [
			makeEvent('r1-1', 'players/addPlayer', { id: 'p1', name: 'P1' }, 10),
			makeEvent('r1-2', 'players/setHand', { id: 'p1', hand: [1, 2, 3, 4, 5] }, 10, 1),
			makeEvent('r1-3', 'game/start', { deck: [], turnOrder: ['p1'], initialPublic: [], seed: 1 }, 10, 2),
			makeEvent('r1-4', 'ui/markDeductions', { marks: { 1: 'X' }, playerId: 'p1' }, 11),
			makeEvent('r1-5', 'game/setWinner', 'p1', 12),
			makeEvent('r2-1', 'players/addPlayer', { id: 'p1', name: 'P1' }, 20),
			makeEvent('r2-2', 'players/setHand', { id: 'p1', hand: [6, 7, 8, 9, 10] }, 20, 1),
			makeEvent('r2-3', 'game/start', { deck: [], turnOrder: ['p1'], initialPublic: [], seed: 2 }, 20, 2),
			makeEvent('r2-4', 'ui/markDeductions', { marks: { 6: 'OK' }, playerId: 'p1' }, 21)
		];

		const plan = planGameBatch(events, null);
		expect(plan.clearPlayersFirst).toBe(false);
		expect(plan.nextGameStartEventId).toBe('r2-3');
		expect(plan.steps.map((s) => (s.kind === 'event' ? s.event.id : 'resetUI'))).toEqual([
			'r2-1',
			'r2-2',
			'r2-3',
			'r2-4'
		]);
	});

	test('clears players and resets UI at game/start on a live rematch while preserving post-start UI events', () => {
		const rematchBatch = [
			makeEvent('r2-1', 'players/addPlayer', { id: 'p1', name: 'P1' }, 20),
			makeEvent('r2-2', 'players/setHand', { id: 'p1', hand: [6, 7, 8, 9, 10] }, 20, 1),
			makeEvent('r2-3', 'game/start', { deck: [], turnOrder: ['p1'], initialPublic: [], seed: 2 }, 20, 2),
			makeEvent('r2-4', 'ui/markDeductions', { marks: { 6: 'OK' }, playerId: 'p1' }, 21)
		];

		const plan = planGameBatch(rematchBatch, 'r1-3');
		expect(plan.clearPlayersFirst).toBe(true);
		expect(plan.nextGameStartEventId).toBe('r2-3');
		expect(plan.steps.map((s) => (s.kind === 'event' ? s.event.id : 'resetUI'))).toEqual([
			'r2-1',
			'r2-2',
			'r2-3',
			'resetUI',
			'r2-4'
		]);
	});
});
