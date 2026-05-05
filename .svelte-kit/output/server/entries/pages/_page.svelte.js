import "../../chunks/index-server.js";
import { B as escape_html, Y as fallback, i as bind_props, l as stringify, n as attr_class, o as ensure_array_like, r as attr_style, s as head, z as attr } from "../../chunks/dev.js";
import { configureStore, createSlice } from "@reduxjs/toolkit";
var gameSlice = createSlice({
	name: "game",
	initialState: {
		status: "LOBBY",
		deck: [],
		deckIndex: 0,
		publicPool: [],
		turnOrder: [],
		currentPlayerIndex: 0,
		winnerId: null,
		seed: 0
	},
	reducers: {
		start: (state, action) => {
			state.deck = action.payload.deck;
			state.turnOrder = action.payload.turnOrder;
			state.status = "PLAYING";
			state.deckIndex = 0;
			state.publicPool = [];
			state.currentPlayerIndex = 0;
			state.winnerId = null;
		},
		reveal: (state) => {
			if (state.deckIndex < state.deck.length) {
				state.publicPool.push(state.deck[state.deckIndex]);
				state.deckIndex++;
			}
		},
		nextTurn: (state) => {
			state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
		},
		setWinner: (state, action) => {
			state.winnerId = action.payload;
			state.status = "FINISHED";
		}
	}
});
var { start, reveal, nextTurn, setWinner } = gameSlice.actions;
var gameSlice_default = gameSlice.reducer;
var playersSlice = createSlice({
	name: "players",
	initialState: { players: {} },
	reducers: {
		addPlayer: (state, action) => {
			state.players[action.payload.id] = {
				id: action.payload.id,
				name: action.payload.name,
				hand: [],
				clues: [],
				isConnected: true,
				eliminated: false
			};
		},
		setHand: (state, action) => {
			if (state.players[action.payload.id]) state.players[action.payload.id].hand = action.payload.hand.sort((a, b) => a - b);
		},
		addClue: (state, action) => {
			if (state.players[action.payload.id]) state.players[action.payload.id].clues.push(action.payload.clue);
		},
		eliminatePlayer: (state, action) => {
			if (state.players[action.payload]) state.players[action.payload].eliminated = true;
		}
	}
});
var { addPlayer, setHand, addClue, eliminatePlayer } = playersSlice.actions;
var playersSlice_default = playersSlice.reducer;
var uiSlice = createSlice({
	name: "ui",
	initialState: {
		myId: null,
		deductionBoard: {},
		overlay: "NONE"
	},
	reducers: {
		setMyId: (state, action) => {
			state.myId = action.payload;
		},
		markDeduction: (state, action) => {
			state.deductionBoard[action.payload.id] = action.payload.mark;
		},
		setOverlay: (state, action) => {
			state.overlay = action.payload;
		}
	}
});
var { setMyId, markDeduction, setOverlay } = uiSlice.actions;
var uiSlice_default = uiSlice.reducer;
//#endregion
//#region src/lib/store/index.ts
var store = configureStore({ reducer: {
	game: gameSlice_default,
	players: playersSlice_default,
	ui: uiSlice_default
} });
//#endregion
//#region src/lib/game/tiles.ts
var COLORS = [
	"Red",
	"Blue",
	"Yellow",
	"Green",
	"Purple"
];
function getTileData(id) {
	if (id < 1 || id > 60) throw new Error(`Invalid tile ID: ${id}`);
	const colorIndex = (id - 1) % 5;
	const dots = Math.floor((id - 1) / 5) % 3 + 1;
	return {
		id,
		color: COLORS[colorIndex],
		dots
	};
}
//#endregion
//#region src/lib/components/Tile.svelte
function Tile($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let data;
		let id = fallback($$props["id"], null);
		let faceDown = fallback($$props["faceDown"], false);
		const COLOR_MAP = {
			Red: "#D84315",
			Blue: "#1565C0",
			Yellow: "#F9A825",
			Green: "#2E7D32",
			Purple: "#6A1B9A"
		};
		$: data = id !== null ? getTileData(id) : null;
		$$renderer.push(`<div${attr_class("tile svelte-4lsiak", void 0, { "face-down": faceDown })}${attr_style(`--tile-color: ${stringify(data ? COLOR_MAP[data.color] : "#795548")}`)}>`);
		if (!faceDown && data) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="sassy-face svelte-4lsiak">`);
			if (data.id % 3 === 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="eyes svelte-4lsiak"><div class="eye svelte-4lsiak"></div> <div class="eye wink svelte-4lsiak"></div></div> <div class="mouth smile svelte-4lsiak"></div>`);
			} else if (data.id % 3 === 1) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<div class="eyes svelte-4lsiak"><div class="eye svelte-4lsiak"></div> <div class="eye svelte-4lsiak"></div></div> <div class="mouth smirk svelte-4lsiak"></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="eyes svelte-4lsiak"><div class="eye star svelte-4lsiak">★</div> <div class="eye star svelte-4lsiak">★</div></div> <div class="mouth o-mouth svelte-4lsiak"></div>`);
			}
			$$renderer.push(`<!--]--></div> <div class="number svelte-4lsiak">${escape_html(data.id)}</div> <div class="dots svelte-4lsiak"><!--[-->`);
			const each_array = ensure_array_like(Array(data.dots));
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				each_array[$$index];
				$$renderer.push(`<div class="dot svelte-4lsiak"></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="back-pattern svelte-4lsiak"></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
		bind_props($$props, {
			id,
			faceDown
		});
	});
}
//#endregion
//#region src/lib/components/Table.svelte
function Table($$renderer, $$props) {
	let publicPool = fallback($$props["publicPool"], () => [], true);
	let deckSize = fallback($$props["deckSize"], 0);
	let onReveal = $$props["onReveal"];
	$$renderer.push(`<div class="table svelte-1iq5b9c"><div class="deck-area svelte-1iq5b9c"><button class="deck svelte-1iq5b9c"${attr("disabled", deckSize === 0, true)}>`);
	if (deckSize > 0) {
		$$renderer.push("<!--[0-->");
		Tile($$renderer, { faceDown: true });
		$$renderer.push(`<!----> <div class="deck-count svelte-1iq5b9c">${escape_html(deckSize)}</div>`);
	} else {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<div class="empty-deck svelte-1iq5b9c">EMPTY</div>`);
	}
	$$renderer.push(`<!--]--></button></div> <div class="pool-area svelte-1iq5b9c"><h2 class="svelte-1iq5b9c">Public Pool</h2> <div class="pool-tiles svelte-1iq5b9c"><!--[-->`);
	const each_array = ensure_array_like(publicPool);
	for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
		let id = each_array[$$index];
		Tile($$renderer, { id });
	}
	$$renderer.push(`<!--]--></div></div></div>`);
	bind_props($$props, {
		publicPool,
		deckSize,
		onReveal
	});
}
//#endregion
//#region src/lib/components/PlayerStand.svelte
function PlayerStand($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let name = $$props["name"];
		let hand = fallback($$props["hand"], () => [], true);
		let isLocalPlayer = fallback($$props["isLocalPlayer"], false);
		let clues = fallback($$props["clues"], () => [], true);
		$$renderer.push(`<div class="stand-container svelte-24zo3n"><div class="name-tag svelte-24zo3n">${escape_html(name)}</div> <div class="stand svelte-24zo3n"><div class="tiles svelte-24zo3n"><!--[-->`);
		const each_array = ensure_array_like(Array(5));
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			each_array[i];
			$$renderer.push(`<div class="slot svelte-24zo3n">`);
			if (hand[i]) {
				$$renderer.push("<!--[0-->");
				Tile($$renderer, {
					id: hand[i],
					faceDown: isLocalPlayer
				});
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="empty-slot svelte-24zo3n"></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div> <div class="base svelte-24zo3n"></div></div></div>`);
		bind_props($$props, {
			name,
			hand,
			isLocalPlayer,
			clues
		});
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let gameState;
		let playersState;
		store.subscribe(() => {
			const state = store.getState();
			gameState = state.game;
			playersState = state.players;
			state.ui;
		});
		function handleReveal() {
			store.dispatch(reveal());
		}
		head("1uha8ag", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Got Five!</title>`);
			});
		});
		$$renderer.push(`<div class="game-container svelte-1uha8ag"><header class="svelte-1uha8ag"><h1 class="svelte-1uha8ag">Got Five!</h1></header> <main class="svelte-1uha8ag"><div class="top-row svelte-1uha8ag">`);
		if (playersState?.players["p3"]) {
			$$renderer.push("<!--[0-->");
			PlayerStand($$renderer, {
				name: playersState.players["p3"].name,
				hand: playersState.players["p3"].hand
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="middle-row svelte-1uha8ag"><div class="side-col svelte-1uha8ag">`);
		if (playersState?.players["p2"]) {
			$$renderer.push("<!--[0-->");
			PlayerStand($$renderer, {
				name: playersState.players["p2"].name,
				hand: playersState.players["p2"].hand
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="center-col svelte-1uha8ag">`);
		if (gameState) {
			$$renderer.push("<!--[0-->");
			Table($$renderer, {
				publicPool: gameState.publicPool,
				deckSize: gameState.deck.length - gameState.deckIndex,
				onReveal: handleReveal
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="side-col svelte-1uha8ag">`);
		if (playersState?.players["p4"]) {
			$$renderer.push("<!--[0-->");
			PlayerStand($$renderer, {
				name: playersState.players["p4"].name,
				hand: playersState.players["p4"].hand
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="bottom-row svelte-1uha8ag">`);
		if (playersState?.players["p1"]) {
			$$renderer.push("<!--[0-->");
			PlayerStand($$renderer, {
				name: playersState.players["p1"].name,
				hand: playersState.players["p1"].hand,
				isLocalPlayer: true
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></main></div>`);
	});
}
//#endregion
export { _page as default };
