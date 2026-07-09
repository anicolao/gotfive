<script lang="ts">
	import { store } from '../store';
	import { setProfile, type PlayerProfile } from '../store/lobbySlice';
	import { setGameId, setIsHost, setMyId } from '../store/uiSlice';
	import {
		getLobbyRoster,
		initializeFirebaseProfile,
		lobbyGameCodeExists,
		linkCurrentUserWithGoogle,
		subscribeGame,
		subscribeLobby,
		unsubscribeLobby,
		updateUserPresence,
		updateUserVisibility,
		writeLobbyEvent
	} from '../firebase/events';
	import { onMount, onDestroy } from 'svelte';

	let myName = $state('');
	let myAvatar = $state('default');
	let myVisibility: 'visible' | 'lurking' = $state('visible');
	let myId = $state('');

	let mode: 'ONBOARDING' | 'LOBBY' | 'HOSTING_MODAL' | 'HOSTING' | 'JOINING' | 'JOINING_FROM_LINK' = $state('ONBOARDING');

	let hostGameName = $state('');
	let hostGameVisibility: 'public' | 'hidden' = $state('public');
	let hostMaxPlayers = $state(5);

	let targetHostId = $state('');
	let connections: string[] = $state([]);
	let currentGameId = $state('');
	let authError = $state('');
	
	let lobbyState = $state(store.getState().lobby);
	let unsubscribe: () => void;

	onMount(() => {
		unsubscribe = store.subscribe(() => {
			lobbyState = store.getState().lobby;
			if (currentGameId) {
				connections = getLobbyRoster(currentGameId).filter((id) => id !== myId);
			}
		});

		const urlParams = new URLSearchParams(window.location.search);
		const paramMyId = urlParams.get('myId');
		if (paramMyId) {
			myId = paramMyId;
		} else {
			myId = Math.random().toString(36).substring(7);
		}

		const gameId = urlParams.get('gameId');
		if (gameId) {
			targetHostId = gameId;
		}

		const savedProfileStr = localStorage.getItem('playerProfile');
		if (savedProfileStr) {
			try {
				const savedProfile = JSON.parse(savedProfileStr);
				myName = savedProfile.name || '';
				myAvatar = savedProfile.avatar || 'default';
				myVisibility = savedProfile.status || 'visible';
				myId = savedProfile.id || myId;
				if (myName) {
					(async () => {
						await joinGlobalLobby();
						if (gameId) {
							mode = 'JOINING_FROM_LINK';
							await joinGameFromLink();
						}
					})();
				}
			} catch (e) {
				console.error("Failed to parse profile", e);
			}
		} else if (gameId) {
			mode = 'ONBOARDING';
		}
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
		unsubscribeLobby();
	});

	async function saveProfileAndJoinLobby() {
		if (!myName) return;
		authError = '';
		try {
			await joinGlobalLobby();
			const urlParams = new URLSearchParams(window.location.search);
			const gameId = urlParams.get('gameId');
			if (gameId) {
				targetHostId = gameId;
				mode = 'JOINING_FROM_LINK';
				await joinGameFromLink();
			}
		} catch (error) {
			authError = error instanceof Error ? error.message : String(error);
		}
	}
	
	async function joinGlobalLobby() {
		const user = await initializeFirebaseProfile(myName, myAvatar, myVisibility);
		myId = user.uid;
		const profile: PlayerProfile = {
			id: user.uid,
			name: user.displayName,
			avatar: user.avatar,
			status: user.visibility,
			activity: 'idle',
			lastSeen: user.lastSeenAt
		};
		localStorage.setItem('playerProfile', JSON.stringify({ ...profile, id: user.uid }));
		store.dispatch(setProfile(profile));
		store.dispatch(setMyId(user.uid));
		await subscribeLobby(store.dispatch);
		mode = 'LOBBY';
	}
	
	async function updateProfileVisibility() {
		myVisibility = myVisibility === 'visible' ? 'lurking' : 'visible';
		if (lobbyState.profile) {
			const updatedProfile = { ...lobbyState.profile, status: myVisibility };
			store.dispatch(setProfile(updatedProfile));
			await updateUserVisibility(myVisibility);
			localStorage.setItem('playerProfile', JSON.stringify(updatedProfile));
		}
	}

	function openHostModal() {
		hostGameName = `${myName}'s Game`;
		mode = 'HOSTING_MODAL';
	}

	function cancelHost() {
		mode = 'LOBBY';
	}

	function randomGameCode() {
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const bytes = new Uint8Array(5);
		crypto.getRandomValues(bytes);
		return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
	}

	async function createUniqueGameCode() {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const code = randomGameCode();
			if (!(await lobbyGameCodeExists(code))) return code;
		}
		throw new Error('Could not create a unique game code. Please try again.');
	}

	async function confirmHostGame() {
		const urlParams = new URLSearchParams(window.location.search);
		const requestedGameId = urlParams.get('hostGameId');
		currentGameId = requestedGameId ? requestedGameId.trim().toUpperCase() : await createUniqueGameCode();
		store.dispatch(setIsHost(true));
		store.dispatch(setGameId(currentGameId));
		await updateUserPresence(currentGameId);
		await writeLobbyEvent('lobby/createGame', {
			gameId: currentGameId,
			name: hostGameName,
			visibility: hostGameVisibility,
			maxPlayers: hostMaxPlayers
		});
		await writeLobbyEvent('lobby/joinGame', { gameId: currentGameId, uid: myId });
		await subscribeGame(currentGameId, store.dispatch);
		mode = 'HOSTING';
	}

	async function joinGame(hostId: string) {
		if (!hostId) return;
		const gameId = hostId.trim().toUpperCase();
		targetHostId = gameId;
		currentGameId = gameId;
		mode = 'JOINING';
		store.dispatch(setIsHost(false));
		store.dispatch(setGameId(gameId));
		await updateUserPresence(gameId);
		await writeLobbyEvent('lobby/joinGame', { gameId, uid: myId });
		await subscribeGame(gameId, store.dispatch);
		connections = getLobbyRoster(gameId).filter((id) => id !== myId);
	}

	async function joinGameFromLink() {
		await joinGame(targetHostId);
	}

	function normalizeTargetHostId() {
		targetHostId = targetHostId.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function copyInviteLink() {
		const url = new URL(window.location.href);
		url.searchParams.set('gameId', currentGameId);
		navigator.clipboard.writeText(url.toString());
	}
	
	function getPlayersArray() {
		return Object.values(lobbyState.players).sort((a, b) => {
			if (a.id === myId) return -1;
			if (b.id === myId) return 1;
			return b.lastSeen - a.lastSeen;
		});
	}
	
	function getPublicGamesArray() {
		return Object.values(lobbyState.publicGames).filter(g => g.visibility === 'public');
	}

	function getCurrentRoster() {
		return myId ? [myId, ...connections] : connections;
	}

	async function signInWithGoogle() {
		await linkCurrentUserWithGoogle();
	}
</script>

<div class="lobby groovy-panel">
	<div class="lobby-header-row">
		<h2>Got Five! Lobby</h2>
	</div>

	{#if mode === 'ONBOARDING'}
		<div class="step">
			<h3>Create Profile</h3>
			<div class="input-group">
				<label for="name">Your Name:</label>
				<input type="text" id="name" bind:value={myName} placeholder="Enter your name" />
			</div>
			<div class="input-group">
				<label for="visibility">Visibility:</label>
				<select id="visibility" bind:value={myVisibility}>
					<option value="visible">Visible (Others can see you in lobby)</option>
					<option value="lurking">Lurking (Hide from others)</option>
				</select>
			</div>
			<div class="actions">
				<button class="groovy-button" onclick={saveProfileAndJoinLobby} disabled={!myName}>Join Lobby</button>
			</div>
			{#if authError}
				<p class="waiting">{authError}</p>
			{/if}
		</div>

	{:else if mode === 'LOBBY'}
		<div class="lobby-layout">
			<div class="lobby-sidebar">
				<div class="profile-card">
					<h3>My Profile</h3>
					<p><strong>{myName}</strong></p>
					<p>Status: <span class={myVisibility === 'visible' ? 'text-cyan' : 'text-muted'}>{myVisibility}</span></p>
					<button class="groovy-button-small" onclick={updateProfileVisibility}>
						Toggle Visibility
					</button>
					<button class="groovy-button-small" onclick={signInWithGoogle}>
						Link Google Account
					</button>
				</div>

				<div class="players-list-panel">
					<h3>Players in Lobby</h3>
					<ul class="players-list">
						{#each getPlayersArray() as player}
							{#if player.status === 'visible' || player.id === myId}
								<li class={player.id === myId ? 'me' : ''}>
									{player.name} {player.id === myId ? '(You)' : ''}
									{#if player.activity === 'playing'}
										<span class="activity-tag">playing</span>
									{/if}
								</li>
							{/if}
						{/each}
						{#if getPlayersArray().filter(p => p.status === 'lurking' && p.id !== myId).length > 0}
							<li class="lurkers-count">
								+ {getPlayersArray().filter(p => p.status === 'lurking' && p.id !== myId).length} lurking
							</li>
						{/if}
					</ul>
				</div>
			</div>

			<div class="lobby-main">
				<div class="games-header">
					<h3>Public Games</h3>
					<button class="groovy-button" onclick={openHostModal}>Host New Game</button>
				</div>

				<div class="games-list">
					{#if getPublicGamesArray().length === 0}
						<p class="empty-state">No public games available right now.</p>
					{:else}
						{#each getPublicGamesArray() as game}
							<div class="game-card">
								<div class="game-info">
									<h4>{game.name}</h4>
									<p>Host: {game.hostName}</p>
									<p>Players: {game.playerCount} / {game.maxPlayers}</p>
								</div>
								<button class="groovy-button" onclick={() => joinGame(game.hostId)}>Join</button>
							</div>
						{/each}
					{/if}
				</div>
				
				<div class="join-private">
					<h4>Join Private Game</h4>
					<div class="id-input">
						<input
							type="text"
							bind:value={targetHostId}
							oninput={normalizeTargetHostId}
							placeholder="ABCDE"
							maxlength="5"
							autocapitalize="characters"
							spellcheck="false"
						/>
						<button class="groovy-button" onclick={() => joinGame(targetHostId)}>Connect</button>
					</div>
				</div>
			</div>
		</div>

	{:else if mode === 'HOSTING_MODAL'}
		<div class="step">
			<h3>Host a Game</h3>
			<div class="input-group">
				<label for="gameName">Game Name:</label>
				<input type="text" id="gameName" bind:value={hostGameName} />
			</div>
			<div class="input-group">
				<label for="gameVis">Visibility:</label>
				<select id="gameVis" bind:value={hostGameVisibility}>
					<option value="public">Public (Show in Lobby)</option>
					<option value="hidden">Hidden (Invite Only)</option>
				</select>
			</div>
			<div class="actions">
				<button class="groovy-button" onclick={confirmHostGame}>Start Hosting</button>
				<button class="groovy-button alt" onclick={cancelHost}>Cancel</button>
			</div>
		</div>

	{:else if mode === 'HOSTING'}
		<div class="step">
			<p>Your Game ID (share this with friends):</p>
			<div class="id-display">
				<code>{currentGameId}</code>
				<button onclick={() => copyToClipboard(currentGameId)}>Copy</button>
			</div>
			<p>Or share this invite link:</p>
			<button class="groovy-button" onclick={copyInviteLink}>Copy Invite Link</button>
		</div>

		<div class="status">
			<h3>Connected Players ({getCurrentRoster().length})</h3>
			<ul>
				<li>{myName} (You - Host)</li>
				{#each getCurrentRoster().filter(id => id !== myId) as id}
					<li>{id}</li>
				{/each}
			</ul>
		</div>

	{:else if mode === 'JOINING' || mode === 'JOINING_FROM_LINK'}
		<div class="status">
			<h3>Connection Status</h3>
			{#if currentGameId}
				<p class="connected">Connected to Host!</p>
				<ul>
					<li>{myName} (You)</li>
					<li>Game: {targetHostId}</li>
				</ul>
				<p>Waiting for host to start...</p>
			{:else}
				<p class="waiting">Waiting to connect to {targetHostId}...</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.lobby {
		width: 100%;
		text-align: center;
		color: var(--color-text-main);
	}
	h2 {
		margin-top: 0;
		font-size: 2rem;
		color: var(--color-neon-cyan);
		text-transform: uppercase;
		letter-spacing: 2px;
		text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
	}
	h3 { color: var(--color-neon-magenta); }

	.lobby-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
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
		color: var(--color-text-main);
		font-size: 1.1rem;
	}

	input, select {
		padding: 12px;
		font-size: 1.1rem;
		border: 1px solid var(--color-neon-cyan);
		border-radius: 8px;
		width: 80%;
		background-color: rgba(0, 0, 0, 0.5);
		color: var(--color-text-main);
		box-shadow: inset 0 0 5px rgba(0, 229, 255, 0.2);
	}

	input:focus, select:focus {
		outline: none;
		border-color: var(--color-neon-magenta);
		box-shadow: 0 0 10px rgba(255, 0, 212, 0.4), inset 0 0 5px rgba(255, 0, 212, 0.2);
	}

	.status p, .step p, li, label {
		color: var(--color-text-main) !important;
	}

	.actions {
		display: flex;
		gap: 20px;
		justify-content: center;
		margin-top: 15px;
	}
	
	.groovy-button.alt {
		background-color: transparent;
		border: 1px solid var(--color-neon-cyan);
	}

	.step {
		margin-bottom: 30px;
		padding: 20px;
		background: rgba(0,0,0,0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
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
		background: rgba(0, 0, 0, 0.6);
		padding: 5px 15px;
		border: 1px solid var(--color-neon-yellow);
		color: var(--color-neon-yellow);
		border-radius: 4px;
		font-weight: bold;
		text-shadow: 0 0 5px rgba(255, 234, 0, 0.5);
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.connected { color: var(--color-neon-cyan); font-weight: bold; text-shadow: 0 0 5px rgba(0, 229, 255, 0.5); }
	.waiting { font-style: italic; opacity: 0.7; color: var(--color-text-muted); }

	/* Lobby specific layout */
	.lobby-layout {
		display: flex;
		gap: 20px;
		margin-top: 20px;
		text-align: left;
	}
	.lobby-sidebar {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.lobby-main {
		flex: 2;
		background: rgba(0,0,0,0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 20px;
	}
	.profile-card, .players-list-panel {
		background: rgba(0,0,0,0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 15px;
	}
	.players-list {
		max-height: 250px;
		overflow-y: auto;
	}
	.players-list .me { color: var(--color-neon-cyan); font-weight: bold; }
	.players-list .lurkers-count { font-style: italic; color: var(--color-text-muted); }
	.activity-tag {
		font-size: 0.6rem;
		text-transform: uppercase;
		background: var(--color-neon-magenta);
		color: black;
		padding: 1px 4px;
		border-radius: 3px;
		margin-left: 5px;
		font-weight: bold;
		vertical-align: middle;
	}
	
	.games-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}
	.games-list {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-bottom: 30px;
	}
	.game-card {
		background: rgba(255,255,255,0.05);
		border: 1px solid var(--color-neon-cyan);
		border-radius: 8px;
		padding: 15px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.game-info h4 { margin: 0 0 5px 0; color: var(--color-neon-yellow); }
	.game-info p { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
	
	.empty-state {
		text-align: center;
		font-style: italic;
		opacity: 0.7;
		padding: 20px;
	}
	
	.join-private {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 20px;
	}

	.text-cyan { color: var(--color-neon-cyan); }
	.text-muted { color: var(--color-text-muted); }
	.groovy-button-small {
		background: rgba(0, 229, 255, 0.1);
		border: 1px solid var(--color-neon-cyan);
		color: var(--color-text-main);
		padding: 5px 10px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		margin-top: 5px;
	}

	@media (max-width: 768px) {
	        .step {
	                margin-bottom: 5px;
	                padding: 10px;
	        }
		.lobby-layout {
			flex-direction: column;
			gap: 5px;
		}
		.lobby-main {
			padding: 5px;
		}
		.profile-card, .players-list-panel {
			padding: 5px;
		}
		.games-list {
			gap: 5px;
			margin-bottom: 10px;
		}
		.game-card {
			padding: 5px;
		}
		.join-private {
			padding-top: 5px;
		}
		h2 { font-size: 1.2rem; }
		h3 { font-size: 1rem; margin: 2px 0; }
		.input-group { margin-bottom: 5px; }
		input, select { padding: 8px; font-size: 1rem; }
	}
</style>
