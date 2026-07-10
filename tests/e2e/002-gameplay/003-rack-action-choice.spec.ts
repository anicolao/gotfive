import { test, expect, type Page } from '@playwright/test';

async function startTwoPlayerGame(page: Page, gameId: string) {
	await page.goto(`/?seed=123&myId=${gameId.toLowerCase()}-user&lobbyId=lobby-${gameId.toLowerCase()}&hostGameId=${gameId}`);
	await page.getByLabel('Your Name:').fill('You');
	await page.getByRole('button', { name: 'Join Lobby' }).click();
	await page.getByRole('button', { name: 'Host New Game' }).click();
	await page.getByRole('button', { name: 'Start Hosting' }).click();
	await page.evaluate(() => {
		(window as any).store.dispatch({
			type: 'players/addPlayer',
			payload: { id: 'alice-id', name: 'Alice' }
		});
	});
	await page.getByRole('button', { name: 'START GAME' }).click();
}

async function selectFirstPublicTile(page: Page) {
	await page.locator('.deck-btn.red').click();
	const tile = page.locator('.pool-tiles .tile-btn').first();
	await expect(tile).toBeEnabled();
	await tile.click();
}

async function clickLowerThird(locator: ReturnType<Page['locator']>) {
	const box = await locator.boundingBox();
	if (!box) throw new Error('target has no bounding box');
	await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height * 0.85);
}

test('lower tile tap asks whether to match or sort', async ({ page }) => {
	await startTwoPlayerGame(page, 'CHOOS');
	await selectFirstPublicTile(page);

	const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
	const aliceFirstSlot = aliceStand.locator('.slot').first();
	await clickLowerThird(aliceFirstSlot);

	const dialog = page.getByRole('dialog', { name: 'Choose clue action' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Match' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Sort' })).toBeVisible();

	await dialog.getByRole('button', { name: 'Match' }).click();

	await expect(aliceFirstSlot.locator('.compare-indicators .compare-clue')).toBeVisible();
	await expect(aliceStand.locator('.notch.active')).toHaveCount(0);
});

test('rack base remains a direct sort target', async ({ page }) => {
	await startTwoPlayerGame(page, 'SORTS');
	await selectFirstPublicTile(page);

	const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
	await aliceStand.getByRole('button', { name: 'Sort Alice' }).click();

	await expect(aliceStand.locator('.notch.active')).toHaveCount(1);
	await expect(aliceStand.locator('.compare-indicators .compare-clue')).toHaveCount(0);
});
