import { PeerManager } from './peerManager';

let peerManager: PeerManager | null = null;
let isHost = false;

export function initNetwork(myId: string, dispatch: any, host: boolean = false, getState?: () => any) {
	if (peerManager) {
		peerManager.disconnect();
	}
	peerManager = new PeerManager(myId);
	isHost = host;
	
	peerManager.onMessage = (msg) => {
		if (msg.type === 'ACTION') {
			const { type, payload } = msg.payload;
			// Dispatch the action locally, marking it as remote to avoid rebroadcasting
			dispatch({ type, payload, meta: { remote: true } });
			
			// Relay to other peers if I am the host
			if (isHost && peerManager) {
				peerManager.broadcast(msg, msg.from);
			}
		} else if (msg.type === 'SYNC') {
			// Handle full state sync
			if (msg.payload.players) {
				Object.values(msg.payload.players).forEach((p: any) => {
					dispatch({ type: 'players/addPlayer', payload: { id: p.id, name: p.name }, meta: { remote: true } });
				});
			}
			if (msg.payload.game) {
				dispatch({ type: 'game/sync', payload: msg.payload.game, meta: { remote: true } });
			}
		}
	};

	peerManager.onConnect = (id) => {
		if (isHost && getState) {
			const state = getState();
			// Send full state to the new peer
			peerManager?.sendTo(id, {
				type: 'SYNC',
				payload: {
					players: state.players.players,
					game: state.game
				},
				from: myId
			});
		} else if (!isHost && getState) {
			const state = getState();
			// Find my own player info and send it to the host
			const me = state.players.players[myId];
			if (me) {
				peerManager?.sendTo(id, {
					type: 'ACTION',
					payload: {
						type: 'players/addPlayer',
						payload: { id: me.id, name: me.name }
					},
					from: myId
				});
			}
		}
	};

	return peerManager;
}

export function getPeerManager() {
	return peerManager;
}

// Middleware to broadcast actions
export const networkMiddleware = (store: any) => (next: any) => (action: any) => {
	const result = next(action);
	const pm = getPeerManager();
	
	if (pm && !action.meta?.remote) {
		const syncableActions = [
			'game/start',
			'game/reveal',
			'game/nextTurn',
			'game/setWinner',
			'players/addPlayer',
			'players/setHand',
			'players/clue_sort',
			'players/clue_compare',
			'players/eliminatePlayer',
			'players/guess'
		];

		if (syncableActions.includes(action.type)) {
			pm.broadcast({
				type: 'ACTION',
				payload: {
					type: action.type,
					payload: action.payload
				},
				from: pm.myId
			});
		}
	}
	
	return result;
};
