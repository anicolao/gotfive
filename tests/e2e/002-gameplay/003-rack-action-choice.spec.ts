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
	await expect(aliceStand.locator('.sort-clues')).toHaveCount(0);
});

test('rack base remains a direct sort target', async ({ page }) => {
	await startTwoPlayerGame(page, 'SORTS');
	await selectFirstPublicTile(page);

	const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
	await aliceStand.getByRole('button', { name: 'Sort Alice' }).click();

	await expect(aliceStand.locator('.sort-clues')).toHaveCount(1);
	await expect(aliceStand.locator('.compare-indicators .compare-clue')).toHaveCount(0);

	const lanes = aliceStand.locator('.notch');
	const slots = aliceStand.locator('.slot');
	const occupiedLane = aliceStand.locator('.notch:has(.sort-clues)');
	const clueAnchor = occupiedLane.locator('.clue-tile-3d');
	const [firstLaneBox, firstSlotBox, lastLaneBox, lastSlotBox, occupiedLaneBox, clueAnchorBox] = await Promise.all([
		lanes.first().boundingBox(),
		slots.first().boundingBox(),
		lanes.last().boundingBox(),
		slots.last().boundingBox(),
		occupiedLane.boundingBox(),
		clueAnchor.boundingBox()
	]);
	if (!firstLaneBox || !firstSlotBox || !lastLaneBox || !lastSlotBox || !occupiedLaneBox || !clueAnchorBox) {
		throw new Error('rack sorting geometry is unavailable');
	}

	expect(firstLaneBox.x + firstLaneBox.width).toBeLessThanOrEqual(firstSlotBox.x);
	expect(lastLaneBox.x).toBeGreaterThanOrEqual(lastSlotBox.x + lastSlotBox.width);
	expect(occupiedLaneBox.width).toBeGreaterThanOrEqual(clueAnchorBox.width);
	expect(
		Math.abs(
			occupiedLaneBox.x + occupiedLaneBox.width / 2 -
			(clueAnchorBox.x + clueAnchorBox.width / 2)
		)
	).toBeLessThanOrEqual(0.5);
});

test('a physical tile flies continuously from deck to pool to clue', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await startTwoPlayerGame(page, 'FLIES');

	const scene = page.locator('.unified-tile-scene');
	await expect(scene).toHaveAttribute('data-moving-tile-count', '0');

	await page.locator('.deck-btn.red').click();
	await expect(scene).toHaveAttribute(
		'data-last-tile-motion',
		/tile-\d+:Red draw deck>3D public tile pool/
	);
	await expect(scene).toHaveAttribute('data-moving-tile-count', /^[1-9]\d*$/);
	await expect(scene).toHaveAttribute('data-moving-tile-count', '0');

	const drawnTile = page.locator('.pool-tiles .tile-btn').last();
	await drawnTile.click();
	const aliceStand = page.locator('.stand-container').filter({ hasText: 'Alice' });
	await aliceStand.getByRole('button', { name: 'Sort Alice' }).click();

	await expect(scene).toHaveAttribute(
		'data-last-tile-motion',
		/tile-\d+:3D public tile pool>Alice's sort clue/
	);
	await expect(scene).toHaveAttribute('data-moving-tile-count', /^[1-9]\d*$/);
	await expect(scene).toHaveAttribute('data-moving-tile-count', '0');
});
