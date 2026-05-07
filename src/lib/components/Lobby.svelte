<script lang="ts">
	import { initNetwork } from '../network';
	import { store } from '../store';
	import { addPlayer } from '../store/playersSlice';
	import { setMyId } from '../store/uiSlice';
	import { onMount } from 'svelte';

	let myName = '';
	let myId = Math.random().toString(36).substring(7);
	let peerManager: any = null;
	let mode: 'CHOOSING' | 'HOSTING' | 'JOINING' = 'CHOOSING';
	
	let offerText = '';
	let answerText = '';
	let currentPeer: any = null;
	let connections: string[] = [];

	onMount(() => {
		const savedName = localStorage.getItem('playerName');
		if (savedName) myName = savedName;
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
		const { peer, offer } = await peerManager.createOffer();
		currentPeer = peer;
		offerText = offer;
	}

	async function joinGame() {
		await startLobby(false);
		mode = 'JOINING';
	}

	async function submitOffer() {
		const { peer, answer } = await peerManager.acceptOffer(offerText);
		currentPeer = peer;
		answerText = answer;
		peerManager.finalizeConnection(peer, 'host');
	}

	function submitAnswer() {
		peerManager.finalizeConnection(currentPeer, 'peer-' + connections.length, answerText);
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		alert('Copied to clipboard!');
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
			<button class="groovy-button" on:click={hostGame}>Host Game</button>
			<button class="groovy-button" on:click={joinGame}>Join Game</button>
		</div>
	{:else if mode === 'HOSTING'}
		<div class="step">
			<p>1. Copy this offer and send it to your friend:</p>
			<textarea readonly value={offerText}></textarea>
			<button on:click={() => copyToClipboard(offerText)}>Copy Offer</button>
		</div>
		<div class="step">
			<p>2. Paste the answer they send back here:</p>
			<textarea bind:value={answerText}></textarea>
			<button on:click={submitAnswer}>Connect</button>
		</div>
	{:else if mode === 'JOINING'}
		<div class="step">
			<p>1. Paste the offer from the host here:</p>
			<textarea bind:value={offerText}></textarea>
			<button on:click={submitOffer}>Generate Answer</button>
		</div>
		{#if answerText}
			<div class="step">
				<p>2. Copy this answer and send it back to the host:</p>
				<textarea readonly value={answerText}></textarea>
				<button on:click={() => copyToClipboard(answerText)}>Copy Answer</button>
			</div>
		{/if}
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

	input, textarea {
		width: 100%;
		padding: 0.5rem;
		border: 2px solid var(--color-primary);
		border-radius: 8px;
		font-family: inherit;
	}

	textarea {
		height: 100px;
		resize: vertical;
		font-size: 0.8rem;
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
</style>
