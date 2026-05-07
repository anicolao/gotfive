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

		this.peer.on('error', (err) => {
			console.error('PeerJS error:', err);
		});
	}

	public connect(targetId: string) {
		const conn = this.peer.connect(targetId);
		this.setupConnection(conn);
	}

	private setupConnection(conn: DataConnection) {
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
