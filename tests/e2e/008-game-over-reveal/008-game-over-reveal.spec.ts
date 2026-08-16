import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('reveals every hand and marks correct deductions when the game ends', async ({ page }, testInfo) => {
	const tester = new TestStepHelper(page, testInfo);
	tester.setMetadata(
		'Game Over Hand Reveal',
		'Testing that game over reveals every tile and celebrates deductions the viewer got right.'
	);

	await page.goto('/?seed=123&myId=reveal-test-user&lobbyId=lobby-008-reveal&hostGameId=REVEA');
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

	const myStand = page.locator('.stand-container').filter({ hasText: 'You' });
	await expect(myStand.locator('.tile.face-down')).toHaveCount(5);
	const { correctTileId, incorrectTileId, winnerId } = await page.evaluate(() => {
		const state = (window as any).store.getState();
		const hand = state.players.players[state.ui.myId].hand;
		return {
			correctTileId: hand[0],
			incorrectTileId: hand[1],
			winnerId: state.ui.myId
		};
	});

	await page.evaluate(({ correctTileId, incorrectTileId, winnerId }) => {
		const store = (window as any).store;
		store.dispatch({ type: 'ui/markDeduction', payload: { id: correctTileId, mark: 'OK' } });
		store.dispatch({ type: 'ui/markDeduction', payload: { id: incorrectTileId, mark: 'X' } });
		store.dispatch({ type: 'game/setWinner', payload: winnerId });
	}, { correctTileId, incorrectTileId, winnerId });

	await tester.step('all-hands-revealed', {
		description: 'Game over reveals every hand and marks the correctly deduced tile',
		verifications: [
			{
				spec: 'All ten hand tiles are face up',
				check: async () => {
					await expect(page.locator('.stand-container .tile.face-down')).toHaveCount(0);
					await expect(page.locator('.stand-container .tile .number')).toHaveCount(10);
				}
			},
			{
				spec: 'The correctly deduced tile has a checkmark',
				check: async () => {
					const correctTile = page.locator(`.tile[data-tile-id="${correctTileId}"]`);
					await expect(correctTile.getByLabel('Correctly deduced')).toHaveText('✓');
				}
			},
			{
				spec: 'An incorrect deduction is not marked as correct',
				check: async () => {
					const incorrectTile = page.locator(`.tile[data-tile-id="${incorrectTileId}"]`);
					await expect(incorrectTile.getByLabel('Correctly deduced')).toHaveCount(0);
				}
			},
			{
				spec: 'The 3D inspection control is not shown',
				check: async () => {
					await expect(page.getByRole('button', { name: /Inspect 3D|Exit 3D/ })).toHaveCount(0);
				}
			}
		]
	});

	tester.generateDocs();
});
