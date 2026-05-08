<script lang="ts">
	import { initNetwork } from '../network';
	import { store } from '../store';
	import { addPlayer } from '../store/playersSlice';
	import { setMyId, setIsHost } from '../store/uiSlice';
	import { onMount } from 'svelte';

	let myName = $state('');
	let myId = Math.random().toString(36).substring(7);
	let peerManager: any = $state(null);
	let mode: 'CHOOSING' | 'HOSTING' | 'JOINING' | 'JOINING_FROM_LINK' = $state('CHOOSING');

	let targetHostId = $state('');
	let connections: string[] = $state([]);
	onMount(() => {
		const savedName = localStorage.getItem('playerName');
		if (savedName) myName = savedName;

		const urlParams = new URLSearchParams(window.location.search);
		const peerId = urlParams.get('peerId');
		if (peerId) {
			targetHostId = peerId;
			mode = 'JOINING_FROM_LINK';
		}
	});

	async function startLobby(host: boolean) {
		if (!myName) return;
		localStorage.setItem('playerName', myName);
		peerManager = initNetwork(myId, store.dispatch, host, store.getState);
		peerManager.connections.subscribe((c: string[]) => {
			connections = c;
		});
		store.dispatch(setMyId(myId));
		store.dispatch(setIsHost(host));
		store.dispatch(addPlayer({ id: myId, name: myName }));
	}

	async function hostGame() {
		await startLobby(true);
		mode = 'HOSTING';
	}

	async function joinGame() {
		await startLobby(false);
		mode = 'JOINING';
	}

	async function joinGameFromLink() {
		await startLobby(false);
		connectToHost();
		mode = 'JOINING';
	}

	function connectToHost() {
		if (targetHostId) {
			setTimeout(() => {
				peerManager.connect(targetHostId);
			}, 500);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		alert('Copied to clipboard!');
	}

	function copyInviteLink() {
		const url = new URL(window.location.href);
		url.searchParams.set('peerId', myId);
		navigator.clipboard.writeText(url.toString());
		alert('Invite link copied to clipboard!');
	}
</script>

<div class="lobby groovy-panel">
	<h2>Lobby</h2>

	{#if mode === 'CHOOSING'}
		<div class="input-group">
			<label for="name">Your Name:</label>
			<input type="text" id="name" bind:value={myName} placeholder="Enter your name" />
		</div>
		<div class="actions">
			<button class="groovy-button" onclick={hostGame}>Host Game</button>
			<button class="groovy-button" onclick={joinGame}>Join Game</button>
		</div>
	{:else if mode === 'JOINING_FROM_LINK'}
		<div class="input-group">
			<label for="name">Your Name:</label>
			<input type="text" id="name" bind:value={myName} placeholder="Enter your name" />
		</div>
		<div class="actions">
			<button class="groovy-button" onclick={joinGameFromLink}>Join Game</button>
		</div>
	{:else if mode === 'HOSTING'}
		<div class="step">
			<p>Your Game ID (share this with friends):</p>
			<div class="id-display">
				<code>{myId}</code>
				<button onclick={() => copyToClipboard(myId)}>Copy</button>
			</div>
			<p>Or share this invite link:</p>
			<button class="groovy-button" onclick={copyInviteLink}>Copy Invite Link</button>
		</div>

		<div class="status">
			<h3>Connected Players ({connections.length + 1})</h3>
			<ul>
				<li>{myName} (You - Host)</li>
				{#each connections as id}
					<li>{id}</li>
				{/each}
			</ul>
		</div>
	{:else if mode === 'JOINING'}
		<div class="step">
			<label for="hostId">Enter Host Game ID:</label>
			<div class="id-input">
				<input type="text" id="hostId" bind:value={targetHostId} placeholder="e.g. abc123xyz" />
				<button class="groovy-button" onclick={connectToHost}>Connect</button>
			</div>
		</div>

		<div class="status">
			<h3>Connection Status</h3>
			{#if connections.length > 0}
				<p class="connected">Connected to Host!</p>
				<ul>
					<li>{myName} (You)</li>
					<li>Host: {targetHostId}</li>
				</ul>
			{:else}
				<p class="waiting">Waiting to connect...</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.lobby {
		max-width: 500px;
		margin: 20px auto;
		padding: 30px;
		text-align: center;
		background-color: var(--color-cream);
		border: 4px solid var(--color-gold);
		border-radius: 12px;
		box-shadow: 10px 10px 0 var(--color-wood);
		color: var(--color-wood);
	}
h2 {
	margin-top: 0;
	font-size: 2rem;
	color: var(--color-wood);
	text-transform: uppercase;
	letter-spacing: 2px;
	text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
}

.input-group {
	margin-bottom: 20px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
}

label {
	font-weight: bold;
	color: var(--color-wood);
	font-size: 1.1rem;
}

input {
	padding: 12px;
	font-size: 1.1rem;
	border: 3px solid var(--color-wood);
	border-radius: 8px;
	width: 80%;
	background-color: white;
	color: var(--color-wood);
}

input:focus {
	outline: none;
	border-color: var(--color-gold);
	box-shadow: 0 0 0 3px rgba(218, 145, 0, 0.3);
}

.status p, .step p, li, label {
	color: var(--color-wood) !important;
}

	.actions {
		display: flex;
		gap: 20px;
		justify-content: center;
	}

	.step {
		margin-bottom: 30px;
		padding: 20px;
		background: rgba(0,0,0,0.05);
		border-radius: 8px;
	}

	.id-display {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin: 10px 0;
	}

	code {
		font-size: 1.5rem;
		background: white;
		padding: 5px 15px;
		border: 2px solid var(--color-wood);
		border-radius: 4px;
		font-weight: bold;
	}

	.id-input {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 10px;
	}

	.status {
		margin-top: 20px;
		text-align: left;
	}

	ul {
		list-style: none;
		padding: 0;
	}

	li {
		padding: 8px;
		border-bottom: 1px solid rgba(0,0,0,0.1);
	}

	.connected { color: var(--color-avocado); font-weight: bold; }
	.waiting { font-style: italic; opacity: 0.7; }
</style>
