<script lang="ts">
	import { store } from '$lib/store';
	import { markDeduction, addStroke, clearStrokes as clearStrokesAction } from '$lib/store/uiSlice';
	import { guess, eliminatePlayer } from '$lib/store/playersSlice';
	import { setWinner, nextTurn } from '$lib/store/gameSlice';
	import { getTileData } from '$lib/game/tiles';
	import { onMount } from 'svelte';

	let { deductions = {} } = $props();

	const COLORS = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];
	const TILE_IDS_BY_COLOR = COLORS.map((_, i) => {
		const ids = [];
		for (let j = 0; j < 12; j++) {
			ids.push(i + 1 + j * 5);
		}
		return ids;
	});

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let drawing = false;
	let currentStroke: number[][] = [];
	let startPos = { x: 0, y: 0 };
	let moved = false;

	let gameState = $state(store.getState().game);
	let playersState = $state(store.getState().players);
	let uiState = $state(store.getState().ui);
	let visibleTiles = $state(new Set<number>());

	let guessInputs = $state<string[]>(['', '', '', '', '']);
	let canGuess = $derived(guessInputs.every(v => {
		const num = parseInt(v);
		return !isNaN(num) && num > 0 && num <= 60;
	}));

	store.subscribe(() => {
		const state = store.getState();
		gameState = state.game;
		playersState = state.players;
		uiState = state.ui;
		updateVisibleTiles();
		if (uiState.strokes.length === 0 && ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		} else if (ctx) {
			redrawStrokes();
		}
	});

	function updateVisibleTiles() {
		const visible = new Set<number>();
		if (gameState?.publicPool) {
			gameState.publicPool.forEach((id: number) => visible.add(id));
		}
		if (playersState?.players && uiState?.myId) {
			Object.values(playersState.players).forEach((p: any) => {
				if (p.id !== uiState.myId) {
					p.hand.forEach((id: number) => visible.add(id));
				}
			});
		}
		visibleTiles = visible;
	}

	onMount(() => {
		const context = canvas.getContext('2d');
		if (context) {
			ctx = context;
			resizeCanvas();
		}
		window.addEventListener('resize', resizeCanvas);
		return () => window.removeEventListener('resize', resizeCanvas);
	});

	function resizeCanvas() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;

		if (ctx) {
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
			ctx.strokeStyle = 'rgba(62, 39, 35, 0.6)';
			redrawStrokes();
		}
	}

	function redrawStrokes() {
		if (!ctx || !canvas || !uiState?.strokes) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		uiState.strokes.forEach((stroke: number[][]) => {
			if (stroke.length === 0) return;
			ctx.beginPath();
			ctx.moveTo(stroke[0][0], stroke[0][1]);
			for (let i = 1; i < stroke.length; i++) {
				ctx.lineTo(stroke[i][0], stroke[i][1]);
			}
			ctx.stroke();
		});
	}

	function handleMouseDown(e: MouseEvent | TouchEvent) {
		const rect = canvas.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
		const x = clientX - rect.left;
		const y = clientY - rect.top;

		startPos = { x: clientX, y: clientY };
		moved = false;
		drawing = true;
		currentStroke = [[x, y]];

		if (ctx) {
			ctx.beginPath();
			ctx.moveTo(x, y);
		}
	}

	function handleMouseMove(e: MouseEvent | TouchEvent) {
		if (drawing) {
			const rect = canvas.getBoundingClientRect();
			const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
			const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
			const x = clientX - rect.left;
			const y = clientY - rect.top;

			if (Math.abs(clientX - startPos.x) > 5 || Math.abs(clientY - startPos.y) > 5) {
				moved = true;
			}

			currentStroke.push([x, y]);
			if (ctx) {
				ctx.lineTo(x, y);
				ctx.stroke();
			}
		}
	}

	function handleMouseUp(e: MouseEvent | TouchEvent) {
		if (!drawing) return;
		drawing = false;

		if (moved && currentStroke.length > 1) {
			store.dispatch(addStroke(currentStroke));
		} else if (!moved) {
			// Small click, toggle deduction
			canvas.style.pointerEvents = 'none';
			const el = document.elementFromPoint(startPos.x, startPos.y);
			canvas.style.pointerEvents = 'auto';

			const cell = el?.closest('.cell');
			if (cell) {
				const id = parseInt(cell.getAttribute('data-id') || '0');
				if (id) toggleDeduction(id);
			}
			redrawStrokes(); // Clear the "dot" created during mousedown
		}
		currentStroke = [];
	}

	function stopDrawing() {
		if (drawing) {
			handleMouseUp({} as any);
		}
	}

	function toggleDeduction(id: number) {
		const current = deductions[id] || '?';
		let next: '?' | 'X' | 'OK';
		if (current === '?') next = 'X';
		else if (current === 'X') next = 'OK';
		else next = '?';
		store.dispatch(markDeduction({ id, mark: next }));
	}

	function clearDrawing() {
		store.dispatch(clearStrokesAction());
	}

	function submitGuess() {
		if (!uiState?.myId) return;
		const playerId = uiState.myId;
		store.dispatch(guess({ playerId, guessedHand: guessInputs.map(v => parseInt(v)) }));
		
		const state = store.getState();
		const player = state.players.players[playerId];
		
		if (player && player.eliminated) {
			// Notify game slice about elimination (it tracks this in its own state for turn skip logic)
			store.dispatch(eliminatePlayer(playerId));
			
			// If we guessed wrong and were eliminated, move to next turn
			store.dispatch(nextTurn());
			
			// Check if only one player remains
			const activePlayers = Object.values(state.players.players).filter(p => !p.eliminated);
			if (activePlayers.length === 1) {
				store.dispatch(setWinner(activePlayers[0].id));
			}
		} else if (player) {
			// Correct guess!
			store.dispatch(setWinner(playerId));
		}
	}
</script>

<div class="deduction-board">
	<div class="header">
		<h2>Top Secret Log</h2>
		<button onclick={clearDrawing}>Clear Notes</button>
	</div>

	<div class="guess-area">
		<div class="guess-inputs">
			{#each guessInputs as val, i}
				<input type="number" min="1" max="60" bind:value={guessInputs[i]} placeholder="?" />
			{/each}
		</div>
		<button class="groovy-button" disabled={!canGuess} onclick={submitGuess}>
			GOT FIVE!
		</button>
	</div>

	<div class="grid-container">
		<div class="grid">
			{#each TILE_IDS_BY_COLOR as row, i}
				<div class="row">
					<div class="color-label" style="color: var(--color-{COLORS[i].toLowerCase()}, {COLORS[i]})">
						{COLORS[i][0]}
					</div>
					{#each row as id}
						<button
							class="cell {deductions[id] || 'unknown'} {visibleTiles.has(id) ? 'dimmed' : ''}"
							data-id={id}
							onclick={(e) => e.preventDefault()}
						>
							<div class="mini-tile {COLORS[i].toLowerCase()}">
								<span class="num">{id}</span>
								<div class="dots">
									{#each Array(getTileData(id).dots) as _}
										<div class="dot"></div>
									{/each}
								</div>
								{#if deductions[id] === 'X'}
									<div class="strike"></div>
								{:else if deductions[id] === 'OK'}
									<div class="check"></div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/each}
		</div>
		<canvas
			bind:this={canvas}
			onmousedown={handleMouseDown}
			onmousemove={handleMouseMove}
			onmouseup={handleMouseUp}
			onmouseleave={stopDrawing}
			ontouchstart={(e) => { e.preventDefault(); handleMouseDown(e); }}
			ontouchmove={(e) => { e.preventDefault(); handleMouseMove(e); }}
			ontouchend={(e) => { e.preventDefault(); handleMouseUp(e); }}
		></canvas>
	</div>
</div>

<style>
	.deduction-board {
		background-color: var(--color-cream);
		padding: 15px;
		border-radius: 8px;
		border: 4px solid var(--color-gold);
		box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.3);
		color: var(--color-wood);
		width: fit-content;
		position: relative;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	h2 {
		margin: 0;
		font-family: 'Courier New', Courier, monospace;
		text-transform: uppercase;
		font-size: 1.2rem;
		letter-spacing: 2px;
	}

	button {
		font-family: 'Courier New', Courier, monospace;
		background: none;
		border: 1px solid var(--color-wood);
		cursor: pointer;
		padding: 2px 8px;
		font-size: 0.8rem;
	}

	button:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.guess-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin-bottom: 15px;
		padding: 10px;
		background: rgba(0,0,0,0.05);
		border-radius: 8px;
	}

	.guess-inputs {
		display: flex;
		gap: 5px;
	}

	.guess-inputs input {
		width: 35px;
		height: 35px;
		text-align: center;
		border: 2px solid var(--color-wood);
		border-radius: 4px;
		font-family: 'Courier New', Courier, monospace;
		font-weight: bold;
		background: white;
	}

	.got-five-btn {
		background-color: var(--color-gold);
		color: var(--color-wood);
		font-weight: bold;
		padding: 5px 15px;
		border: 2px solid var(--color-wood);
		border-radius: 4px;
		cursor: pointer;
		font-family: 'Courier New', Courier, monospace;
	}

	.got-five-btn:hover {
		background-color: #ffd700;
	}

	.got-five-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.grid-container {
		position: relative;
		border: 2px solid var(--color-wood);
		padding: 10px;
		background: white;
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 2;
		position: relative;
	}

	.row {
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.color-label {
		width: 20px;
		font-weight: bold;
		text-align: center;
	}

	.cell {
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		position: relative;
	}

	.mini-tile {
		width: 24px;
		height: 34px;
		border-radius: 3px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: bold;
		color: white;
		position: relative;
		box-shadow: 1px 1px 2px rgba(0,0,0,0.2);
		transition: transform 0.1s;
		padding: 2px 0;
		box-sizing: border-box;
	}

	@media (max-width: 600px) {
		.deduction-board {
			padding: 8px;
		}

		.mini-tile {
			width: 20px;
			height: 28px;
			font-size: 8px;
		}

		.color-label {
			width: 15px;
			font-size: 0.8rem;
		}

		.grid-container {
			padding: 5px;
		}

		.guess-inputs input {
			width: 30px;
			height: 30px;
			font-size: 0.9rem;
		}
	}

	@media (max-width: 350px) {
		.mini-tile {
			width: 18px;
			height: 25px;
			font-size: 7px;
		}
		
		.row {
			gap: 2px;
		}
	}

	.mini-tile:hover {
		transform: scale(1.1);
		z-index: 2;
	}

	.red { background-color: #D84315; }
	.blue { background-color: #1565C0; }
	.yellow { background-color: #F9A825; }
	.green { background-color: #2E7D32; }
	.purple { background-color: #6A1B9A; }

	.num {
		z-index: 1;
		text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
		line-height: 1;
	}

	.dots {
		display: flex;
		gap: 1px;
		margin-top: 1px;
	}

	.dot {
		width: 4px;
		height: 4px;
		background-color: white;
		border-radius: 50%;
		box-shadow: 1px 1px 1px rgba(0,0,0,0.2);
	}

	.strike {
		position: absolute;
		width: 100%;
		height: 2px;
		background-color: white;
		transform: rotate(45deg);
		z-index: 2;
		top: 16px;
	}

	.strike::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 2px;
		background-color: white;
		transform: rotate(-90deg);
		top: 0;
		left: 0;
	}

	.check {
		position: absolute;
		width: 100%;
		height: 100%;
		border: 3px solid var(--color-gold);
		border-radius: 3px;
		box-sizing: border-box;
		z-index: 2;
		top: 0;
	}

	.dimmed {
		opacity: 0.3;
		filter: grayscale(0.5);
	}

	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: auto;
		cursor: crosshair;
		z-index: 3;
	}
</style>
