<script lang="ts">
	import { store } from '$lib/store';
	import { clearDeductionBoard, markDeductions, setGuessInput as setGuessInputAction } from '$lib/store/uiSlice';
	import { getTileData } from '$lib/game/tiles';
	import { writeGameEvent, writeGameEvents } from '$lib/firebase/events';
	import { onMount } from 'svelte';

	let { deductions = {}, canSubmitGuess = false } = $props();

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
	let visibleTiles = $derived.by(() => {
		const visible = new Set<number>();
		if (gameState?.publicPool) {
			gameState.publicPool.forEach((id: number) => visible.add(id));
		}
		if (playersState?.players && uiState?.myId) {
			Object.values(playersState.players).forEach((p: any) => {
				if (p.id !== uiState.myId) {
					p.hand.forEach((id: number) => visible.add(id));
				}
				if (p.clues) {
					p.clues.forEach((clue: any) => visible.add(clue.tileId));
				}
			});
		}
		return visible;
	});
	let displayDeductions = $derived.by(() => {
		const marks: Record<number, '?' | 'X' | 'OK'> = { ...deductions };
		TILE_IDS_BY_COLOR.forEach((row) => {
			const possibleTiles = row.filter(id => {
				const mark = marks[id] || '?';
				return mark !== 'X' && !visibleTiles.has(id);
			});
			if (possibleTiles.length === 1 && marks[possibleTiles[0]] !== 'X') {
				marks[possibleTiles[0]] = 'OK';
			}
		});
		return marks;
	});
	let effectiveGuessInputs = $derived.by(() => {
		const values = [...(uiState?.guessInputs || ['', '', '', '', ''])];
		while (values.length < 5) values.push('');
		const myId = uiState?.myId;
		const myHand = myId ? playersState?.players[myId]?.hand : null;
		if (myHand && myHand.length === 5) {
			myHand.forEach((tileId: number, i: number) => {
				if (values[i]) return;
				const tileData = getTileData(tileId);
				if (!tileData) return;
				const colorIdx = COLORS.indexOf(tileData.color);
				if (colorIdx === -1) return;
				const okTile = TILE_IDS_BY_COLOR[colorIdx].find(id => displayDeductions[id] === 'OK');
				if (okTile) values[i] = okTile.toString();
			});
		}
		return values.slice(0, 5);
	});
	let canGuess = $derived(canSubmitGuess && effectiveGuessInputs.every(v => {
		const num = parseInt(v);
		return !isNaN(num) && num > 0 && num <= 60;
	}));

	onMount(() => {
		const context = canvas?.getContext('2d');
		if (context) {
			ctx = context;
			resizeCanvas();
		}
		window.addEventListener('resize', resizeCanvas);

		const unsubscribe = store.subscribe(() => {
			if (!canvas || !ctx) return;
			
			const state = store.getState();
			gameState = state.game;
			playersState = state.players;
			uiState = state.ui;
			
			// Defensive check for canvas and ctx to prevent "Cannot read properties of null" errors
			// especially during mount/unmount transitions.
			const c = canvas;
			const context = ctx;
			if (uiState?.strokes?.length === 0) {
				context.clearRect(0, 0, c.width, c.height);
			} else {
				redrawStrokes();
			}
		});

		return () => {
			window.removeEventListener('resize', resizeCanvas);
			unsubscribe();
			ctx = null as any;
		};
	});

	function resizeCanvas() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (!rect) return;
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
		const c = canvas;
		const context = ctx;
		if (!context || !c || !uiState?.strokes) return;
		context.clearRect(0, 0, c.width, c.height);
		uiState.strokes.forEach((stroke: number[][]) => {
			if (stroke.length === 0) return;
			context.beginPath();
			context.moveTo(stroke[0][0], stroke[0][1]);
			for (let i = 1; i < stroke.length; i++) {
				context.lineTo(stroke[i][0], stroke[i][1]);
			}
			context.stroke();
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

	async function writeOwnGameEvent(type: string, payload: any) {
		if (!uiState?.gameId || !uiState?.myId) return;
		await writeGameEvent(uiState.gameId, type, { ...payload, playerId: uiState.myId });
	}

	function handleMouseUp(e: MouseEvent | TouchEvent) {
		if (!drawing) return;
		drawing = false;

		if (moved && currentStroke.length > 1) {
			writeOwnGameEvent('ui/addStroke', {
				points: currentStroke.map(([x, y]) => ({ x, y }))
			});
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
		if (!uiState?.myId) return;
		const current = displayDeductions[id] || '?';
		let next: '?' | 'X' | 'OK';
		const marks: Record<number, '?' | 'X' | 'OK'> = {};
		if (current === '?') next = 'X';
		else if (current === 'X') {
			next = 'OK';
			// One OK per color row: if marking as OK, change any other OK in the same row to ?
			const colorIndex = (id - 1) % 5;
			const rowIds = TILE_IDS_BY_COLOR[colorIndex];
			rowIds.forEach(rowId => {
				if (rowId !== id && displayDeductions[rowId] === 'OK') {
					marks[rowId] = '?';
				}
			});
		}
		else next = '?';
		marks[id] = next;
		store.dispatch(markDeductions({ marks, playerId: uiState.myId }));
		writeOwnGameEvent('ui/markDeductions', { marks });
	}

	let currentGameStartKey = $state<string | null>(null);
	$effect(() => {
		const nextGameStartKey = gameState?.status === 'PLAYING'
			? `${gameState.seed}:${gameState.turnOrder.join('|')}:${gameState.publicPool.join('|')}`
			: null;
		if (nextGameStartKey && nextGameStartKey !== currentGameStartKey) {
			currentGameStartKey = nextGameStartKey;
		} else if (!nextGameStartKey) {
			currentGameStartKey = null;
		}
	});

	function clearBoard() {
		if (uiState?.myId) {
			store.dispatch(clearDeductionBoard({ playerId: uiState.myId }));
		}
		writeOwnGameEvent('ui/clearDeductionBoard', {});
	}

	function setGuessInput(index: number, value: string) {
		const playerId = store.getState().ui.myId;
		if (playerId) {
			store.dispatch(setGuessInputAction({ index, value, playerId }));
		}
		writeOwnGameEvent('ui/setGuessInput', { index, value });
	}

	async function submitGuess() {
		if (!canGuess) return;
		if (!uiState?.myId || !uiState.gameId) return;
		const playerId = uiState.myId;
		const state = store.getState();
		const guessedHand = effectiveGuessInputs.map(v => parseInt(v));
		const player = state.players.players[playerId];
		if (!player) return;

		const actualHandSorted = [...player.hand].sort((a, b) => a - b);
		const guessedHandSorted = [...guessedHand].sort((a, b) => a - b);
		const isCorrect = actualHandSorted.length === guessedHandSorted.length &&
			actualHandSorted.every((value, index) => value === guessedHandSorted[index]);
		const events: Array<{ type: string; payload: any }> = [
			{ type: 'players/guess', payload: { playerId, guessedHand } }
		];

		if (!isCorrect) {
			events.push({ type: 'players/eliminatePlayer', payload: playerId });
			const currentPlayerId = state.game.turnOrder[state.game.currentPlayerIndex];
			if (playerId === currentPlayerId) {
				events.push({ type: 'game/nextTurn', payload: undefined });
			}
			// Check if only one player remains
			const activePlayers = Object.values(state.players.players).filter(p => p.id !== playerId && !p.eliminated);
			if (activePlayers.length === 1) {
				events.push({ type: 'game/setWinner', payload: activePlayers[0].id });
			}
		} else {
			events.push({ type: 'game/setWinner', payload: playerId });
		}
		await writeGameEvents(uiState.gameId, events);
	}
</script>

<div class="deduction-board">
	<div class="header">
		<h2>Top Secret Log</h2>
		<button onclick={clearBoard}>Clear</button>
	</div>

	<div class="guess-area">
		<div class="guess-inputs">
			{#each effectiveGuessInputs as val, i}
				<input
					type="number"
					min="1"
					max="60"
					value={val}
					oninput={(e) => setGuessInput(i, e.currentTarget.value)}
					placeholder="?"
				/>
			{/each}
		</div>
		<button class="groovy-button got-five-btn" disabled={!canGuess} onclick={submitGuess}>
		        GOT FIVE!
		</button>	</div>

	<div class="grid-container">
		<div class="grid">
			{#each TILE_IDS_BY_COLOR as row, i}
				<div class="row">
					{#each row as id}
						<button
							class="cell {displayDeductions[id] || 'unknown'} {visibleTiles.has(id) ? 'dimmed' : ''}"
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
								{#if displayDeductions[id] === 'X'}
									<div class="strike"></div>
								{:else if displayDeductions[id] === 'OK'}
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
                background: var(--color-bg-panel);
                backdrop-filter: blur(12px);
                padding: var(--gap-base);
                border-radius: 12px;
                border: 1px solid var(--color-glass-border);
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 229, 255, 0.1);
                color: var(--color-text-main);
                width: fit-content;
                position: relative;
                margin: 0 auto;
                max-width: 100%;
                box-sizing: border-box;
                flex-shrink: 0;
        }

        .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--gap-base);
        }

        h2 {
                margin: 0;
                font-family: 'Courier New', Courier, monospace;
                text-transform: uppercase;
                font-size: var(--font-size-small);
                letter-spacing: 1px;
                color: var(--color-neon-cyan);
                text-shadow: 0 0 5px rgba(0, 229, 255, 0.5);
        }

        .guess-area {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--gap-base);
                margin-bottom: var(--gap-base);
                padding: var(--gap-base);
                background: rgba(0,0,0,0.5);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .guess-inputs {
                display: flex;
                gap: 6px;
				width: 100%;
				justify-content: center;
        }

        .guess-inputs input {
                width: calc(var(--mini-tile-size) * 1.45);
                height: calc(var(--mini-tile-size) * 1.25);
                min-width: 28px;
                min-height: 24px;
                text-align: center;
                border: 1px solid var(--color-neon-yellow);
                border-radius: 34%;
                font-family: 'Courier New', Courier, monospace;
                font-weight: bold;
                background: rgba(0, 0, 0, 0.8);
                color: var(--color-neon-yellow);
                font-size: max(12px, var(--font-size-small));
                line-height: 1;
                box-sizing: border-box;
				padding: 0;
				appearance: textfield;
        }

		.guess-inputs input::-webkit-inner-spin-button,
		.guess-inputs input::-webkit-outer-spin-button {
				margin: 0;
				appearance: none;
		}

        .got-five-btn {
                font-size: var(--font-size-small);
                padding: 8px 16px;
        }

        .grid-container {
                position: relative;
                border: 1px solid var(--color-glass-border);
                padding: var(--gap-base);
                background: rgba(0, 0, 0, 0.4);
                border-radius: 8px;
                overflow: auto;
                max-height: 100%;
        }

        .grid {
                display: flex;
                flex-direction: column;
                gap: 4px;
                z-index: 2;
                position: relative;
                min-width: min-content;
        }

        .row {
                display: flex;
                gap: 4px;
                align-items: center;
        }

        .cell {
                padding: 0;
                background: none;
                border: none;
                cursor: pointer;
                position: relative;
                width: var(--mini-tile-size);
                height: var(--mini-tile-size);
        }

        .mini-tile {
                width: 100%;
                height: 100%;
                flex-shrink: 0;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: calc(var(--mini-tile-size) * 0.5);
                font-weight: bold;
                color: white;
                position: relative;
                box-shadow:
                        inset 0 2px 2px rgba(255,255,255,0.38),
                        inset 0 -2px 3px rgba(0,0,0,0.22),
                        0 3px 5px rgba(0,0,0,0.5);
                transition: transform 0.1s;
                padding: 0;
                box-sizing: border-box;
                border: 1px solid rgba(255, 255, 255, 0.72);
        }

        .red { background-color: var(--color-candy-red); }
        .blue { background-color: var(--color-candy-blue); }
        .yellow { background-color: var(--color-candy-yellow); }
        .green { background-color: var(--color-candy-green); }
        .purple { background-color: var(--color-candy-purple); }

        .num {
                z-index: 1;
				-webkit-text-stroke: max(1px, calc(var(--mini-tile-size) * 0.055)) #050505;
				paint-order: stroke fill;
				text-shadow: 0 1px 1px rgba(0,0,0,0.8);
                line-height: 1;
        }

        .dots {
                display: flex;
                gap: 1px;
                margin-top: 1px;
        }

        .dot {
                width: calc(var(--mini-tile-size) * 0.15);
                height: calc(var(--mini-tile-size) * 0.15);
                background-color: white;
                border-radius: 50%;
                box-shadow: 1px 1px 1px rgba(0,0,0,0.5);
        }

        .strike {
                position: absolute;
                width: 100%;
                height: 2px;
                background-color: white;
                transform: rotate(45deg);
                z-index: 2;
                top: calc(50% - 1px);
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
                border: 3px solid var(--color-neon-cyan);
                border-radius: 3px;
                box-sizing: border-box;
                z-index: 2;
                top: 0;
                box-shadow: inset 0 0 5px var(--color-neon-cyan), 0 0 5px var(--color-neon-cyan);
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

        @media (orientation: portrait) {
                .deduction-board {
                        width: 100%;
                        margin: 0;
                        padding: 4px;
                        border-radius: 8px;
                }

                .header {
                        gap: 8px;
                }

                .header button {
                        min-height: 28px;
                        white-space: nowrap;
                }

                .guess-inputs {
                        width: 100%;
                        justify-content: center;
                }

                .guess-inputs input {
                        width: 42px;
                        height: 34px;
                        min-width: 42px;
                        min-height: 34px;
                        font-size: 16px;
                }

                .grid-container {
                        width: 100%;
                        box-sizing: border-box;
                        overflow: visible;
                        padding: 4px;
                }

                .grid {
                        width: 100%;
                        gap: 4px;
                }

                .row {
                        display: grid;
                        grid-template-columns: repeat(12, minmax(0, 1fr));
                        gap: 4px;
                        width: 100%;
                }

                .cell {
                        width: auto;
                        height: auto;
                        aspect-ratio: 1;
                }
        }

        @media (orientation: portrait) and (max-height: 760px) {
                .deduction-board {
                        width: min(100%, 330px);
                        margin: 0 auto;
                }

                .guess-area {
                        padding: 2px;
                        margin-bottom: 2px;
                }

                .guess-inputs input {
                        width: 34px;
                        height: 30px;
                        min-width: 34px;
                        min-height: 30px;
                }

                .got-five-btn {
                        padding: 4px 12px;
                }

                .row {
                        gap: 3px;
                }
        }
</style>
