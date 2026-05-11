import { Peer, type DataConnection } from 'peerjs';
import { writable, type Writable } from 'svelte/store';

export interface NetworkMessage {
	type: 'ACTION' | 'SYNC' | 'CHAT';
	payload: any;
	from: string;
}

export class PeerManager {
	public myId: string;
	public peer: Peer;
	public connectionsMap: Map<string, DataConnection> = new Map();
	public connections: Writable<string[]> = writable([]);
	public onMessage?: (msg: NetworkMessage) => void;
	public onConnect?: (id: string) => void;

	constructor(myId: string) {
		this.myId = myId;
		this.peer = new Peer(myId);

		this.peer.on('connection', (conn) => {
			this.setupConnection(conn);
		});

		this.peer.on('error', (err: any) => {
			if (err.type === 'unavailable-id') {
				console.warn('[PeerManager] Peer ID unavailable:', this.myId);
			} else if (err.type === 'network' || err.type === 'server-error') {
				console.warn(`[PeerManager] PeerJS ${err.type} error, attempting reconnect...`);
				setTimeout(() => {
					if (!this.peer.destroyed && this.peer.disconnected) {
						this.peer.reconnect();
					}
				}, 1000);
			} else {
				console.error('[PeerManager] PeerJS error:', err);
			}
		});
	}

	public connect(targetId: string) {
		const conn = this.peer.connect(targetId);
		if (conn) {
			this.setupConnection(conn);
		} else {
			console.warn(`Failed to create connection to ${targetId}`);
		}
	}

	private setupConnection(conn: DataConnection) {
		if (!conn) return;
		conn.on('open', () => {
			this.connectionsMap.set(conn.peer, conn);
			this.connections.update(c => [...new Set([...c, conn.peer])]);
			if (this.onConnect) this.onConnect(conn.peer);
		});

		conn.on('data', (data) => {
			if (this.onMessage) {
				try {
					const msg = typeof data === 'string' ? JSON.parse(data) : data;
					this.onMessage(msg as NetworkMessage);
				} catch (e) {
					console.error('Failed to parse message', e);
				}
			}
		});

		conn.on('close', () => {
			this.connectionsMap.delete(conn.peer);
			this.connections.update(c => c.filter(pid => pid !== conn.peer));
		});

		conn.on('error', (err) => {
			console.error('Connection error:', err);
		});
	}

	public broadcast(msg: NetworkMessage, excludeId?: string) {
		const data = JSON.stringify(msg);
		this.connectionsMap.forEach((conn, id) => {
			if (conn.open && id !== excludeId) {
				conn.send(data);
			}
		});
	}

	public sendTo(id: string, msg: NetworkMessage) {
		const conn = this.connectionsMap.get(id);
		if (conn && conn.open) {
			conn.send(JSON.stringify(msg));
		}
	}

	public disconnect() {
		this.connectionsMap.forEach(conn => conn.close());
		this.peer.destroy();
	}
}
