<script lang="ts">
	import { initNetwork } from '../network';
	import { store } from '../store';
	import { addPlayer } from '../store/playersSlice';
	import { setMyId } from '../store/uiSlice';
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
		import('../store/uiSlice').then(({ setMyId }) => {
			store.dispatch(setMyId(myId));
		});
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
				<button onclick={() => copyToClipboard(myId)}>Copy ID</button>
				<button onclick={copyInviteLink}>Copy Invite Link</button>
			</div>
		</div>
	{:else if mode === 'JOINING'}
		<div class="step">
			<p>Enter Host's Game ID:</p>
			<input type="text" bind:value={targetHostId} placeholder="e.g. abc123" />
			<button class="groovy-button" onclick={connectToHost} disabled={!targetHostId}>Connect</button>
		</div>
	{/if}

	<div class="status">
		<h3>Players Connected: {connections.length + 1}</h3>
		<ul>
			<li>{myName} (You)</li>
			{#each connections as conn}
				<li>Peer: {conn}</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.lobby {
		max-width: 500px;
		margin: 2rem auto;
		padding: 2rem;
		background: var(--color-bg-panel, #f0e6d2);
		border: 4px solid var(--color-primary, #d4a373);
		border-radius: 20px;
		box-shadow: 10px 10px 0 var(--color-shadow, #bc8a5f);
	}

	h2 {
		font-family: 'Groovy', sans-serif;
		color: var(--color-primary);
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.input-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: bold;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		border: 2px solid var(--color-primary);
		border-radius: 8px;
		font-family: inherit;
		box-sizing: border-box;
		margin-bottom: 1rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.step {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 10px;
	}

	.id-display {
		display: flex;
		align-items: center;
		gap: 10px;
		background: white;
		padding: 10px;
		border-radius: 8px;
		border: 1px solid var(--color-primary);
		flex-wrap: wrap;
	}

	code {
		flex: 1;
		font-family: monospace;
		font-size: 1.2rem;
		font-weight: bold;
	}

	.status {
		margin-top: 2rem;
		border-top: 2px dashed var(--color-primary);
		padding-top: 1rem;
	}

	.groovy-button {
		background: var(--color-accent, #faedcd);
		border: 2px solid var(--color-primary);
		padding: 0.5rem 1rem;
		border-radius: 50px;
		cursor: pointer;
		font-weight: bold;
		transition: transform 0.1s;
	}

	.groovy-button:hover {
		transform: scale(1.05);
	}

	.groovy-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>