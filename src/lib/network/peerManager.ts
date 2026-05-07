import Peer from 'simple-peer';
import { writable, type Writable } from 'svelte/store';

export interface NetworkMessage {
	type: 'ACTION' | 'SYNC' | 'CHAT';
	payload: any;
	from: string;
}

export class PeerManager {
	public myId: string;
	public peers: Map<string, Peer.Instance> = new Map();
	public connections: Writable<string[]> = writable([]);
	public onMessage?: (msg: NetworkMessage) => void;
	public onConnect?: (id: string) => void;

	constructor(myId: string) {		this.myId = myId;
	}

	public createOffer(): Promise<{ peer: Peer.Instance; offer: string }> {
		return new Promise((resolve) => {
			const peer = new Peer({ initiator: true, trickle: false });
			peer.on('signal', (data) => {
				resolve({ peer, offer: JSON.stringify(data) });
			});
			this.setupPeerEvents(peer, 'pending-peer-' + Math.random());
		});
	}

	public acceptOffer(offerStr: string): Promise<{ peer: Peer.Instance; answer: string }> {
		return new Promise((resolve) => {
			const peer = new Peer({ initiator: false, trickle: false });
			peer.on('signal', (data) => {
				resolve({ peer, answer: JSON.stringify(data) });
			});
			this.setupPeerEvents(peer, 'pending-host-' + Math.random());
			peer.signal(JSON.parse(offerStr));
		});
	}

	public finalizeConnection(peer: Peer.Instance, id: string, signalStr?: string) {
		if (signalStr) {
			peer.signal(JSON.parse(signalStr));
		}
		// Replace temporary ID if needed, but here we just track it
		peer.on('connect', () => {
			this.peers.set(id, peer);
			this.connections.update(c => [...new Set([...c, id])]);
			if (this.onConnect) this.onConnect(id);
		});
	}

	private setupPeerEvents(peer: Peer.Instance, tempId: string) {
		peer.on('data', (data) => {
			if (this.onMessage) {
				try {
					this.onMessage(JSON.parse(data.toString()));
				} catch (e) {
					console.error('Failed to parse message', e);
				}
			}
		});

		peer.on('close', () => {
			// Find and remove by instance
			for (const [id, p] of this.peers.entries()) {
				if (p === peer) {
					this.peers.delete(id);
					this.connections.update(c => c.filter(pid => pid !== id));
					break;
				}
			}
		});

		peer.on('error', (err) => {
			console.error('Peer error:', err);
		});
	}

	public broadcast(msg: NetworkMessage, excludeId?: string) {
		const data = JSON.stringify(msg);
		this.peers.forEach((peer, id) => {
			if (peer.connected && id !== excludeId) {
				peer.send(data);
			}
		});
	}

	public sendTo(id: string, msg: NetworkMessage) {
		const peer = this.peers.get(id);
		if (peer && peer.connected) {
			peer.send(JSON.stringify(msg));
		}
	}
}
