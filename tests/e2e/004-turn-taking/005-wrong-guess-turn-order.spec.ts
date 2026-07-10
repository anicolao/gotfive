import { test, expect, type Page } from '@playwright/test';

interface WindowWithStore extends Window {
	store: {
		getState: () => {
			game: { turnOrder: string[]; currentPlayerIndex: number };
			players: { players: Record<string, { eliminated: boolean }> };
		};
	};
}

async function writeRemoteGameEvent(page: Page, type: string, payload?: unknown) {
	await page.evaluate(async (args: { type: string; payload?: unknown }) => {
		const { writeGameEvent } = await (0, eval)('import("/src/lib/firebase/events.ts")');
		const gameId = (window as unknown as { store: { getState: () => { ui: { gameId: string } } } }).store.getState().ui.gameId;
		await writeGameEvent(gameId, args.type, args.payload);
	}, { type, payload });
}

async function startThreePlayerGame(page: Page, gameId: string, lobbyId: string) {
	await page.goto(`/?seed=123&myId=${gameId.toLowerCase()}-user&lobbyId=${lobbyId}&hostGameId=${gameId}`);
	await page.getByLabel('Your Name:').fill('You');
	await page.getByRole('button', { name: 'Join Lobby' }).click();
	await page.getByRole('button', { name: 'Host New Game' }).click();
	await page.getByRole('button', { name: 'Start Hosting' }).click();
	await page.evaluate(() => {
		const store = (window as unknown as { store: { dispatch: (action: unknown) => void } }).store;
		store.dispatch({ type: 'players/addPlayer', payload: { id: 'alice-id', name: 'Alice' } });
		store.dispatch({ type: 'players/addPlayer', payload: { id: 'bob-id', name: 'Bob' } });
	});
	await page.getByRole('button', { name: 'START GAME' }).click();
	await expect(page.locator('.deduction-board .got-five-btn')).toBeVisible();
}

async function currentPlayerId(page: Page) {
	return page.evaluate(() => {
		const state = (window as unknown as WindowWithStore).store.getState();
		return state.game.turnOrder[state.game.currentPlayerIndex];
	});
}

async function advanceUntil(page: Page, predicate: (id: string) => boolean) {
	for (let i = 0; i < 4; i++) {
		const current = await currentPlayerId(page);
		if (predicate(current)) return current;
		await writeRemoteGameEvent(page, 'game/nextTurn');
		await expect.poll(() => currentPlayerId(page)).not.toBe(current);
	}
	throw new Error('Unable to reach requested turn');
}

async function submitWrongGuess(page: Page) {
	const guessInputs = page.locator('.deduction-board .guess-inputs input');
	for (let i = 0; i < 5; i++) {
		await guessInputs.nth(i).fill('1');
	}
	await expect(page.locator('.deduction-board .got-five-btn')).toBeEnabled();
	await page.locator('.deduction-board .got-five-btn').click();
}

test('wrong non-current guess does not advance the turn', async ({ page }) => {
	await startThreePlayerGame(page, 'WRONG', 'lobby-wrong-non-current');
	const myId = 'wrong-user';
	const currentBefore = await advanceUntil(page, (id) => id !== myId);

	await submitWrongGuess(page);

	await expect.poll(() => currentPlayerId(page)).toBe(currentBefore);
	await expect.poll(async () => {
		return page.evaluate(() => (window as unknown as WindowWithStore).store.getState().players.players['wrong-user'].eliminated);
	}).toBe(true);
});

test('wrong current-player guess advances exactly once', async ({ page }) => {
	await startThreePlayerGame(page, 'CURNT', 'lobby-wrong-current');
	const myId = 'curnt-user';
	await advanceUntil(page, (id) => id === myId);
	const stateBefore = await page.evaluate(() => (window as unknown as WindowWithStore).store.getState().game);
	const expectedNext = stateBefore.turnOrder[(stateBefore.currentPlayerIndex + 1) % stateBefore.turnOrder.length];

	await submitWrongGuess(page);

	await expect.poll(() => currentPlayerId(page)).toBe(expectedNext);
	await expect.poll(async () => {
		return page.evaluate(() => (window as unknown as WindowWithStore).store.getState().players.players['curnt-user'].eliminated);
	}).toBe(true);
});
