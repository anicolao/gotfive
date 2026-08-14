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
			}
		]
	});

	const inspectButton = page.getByRole('button', { name: 'Inspect 3D' });
	await expect(inspectButton).toHaveAttribute('aria-pressed', 'false');
	await inspectButton.click();
	await expect(page.getByRole('button', { name: 'Exit 3D' })).toHaveAttribute('aria-pressed', 'true');

	const unifiedScene = page.locator('.unified-tile-scene.inspect');
	await expect(unifiedScene).toHaveAttribute('data-field-count', '4');
	await expect(unifiedScene).toHaveAttribute('data-player-label-count', '2');
	const inspectableCanvas = unifiedScene.locator('canvas');
	await expect(inspectableCanvas).toHaveCount(1);
	const sceneBounds = await inspectableCanvas.boundingBox();
	if (!sceneBounds) throw new Error('The unified game canvas is not available for 3D inspection');
	await page.mouse.move(sceneBounds.x + sceneBounds.width * 0.68, sceneBounds.y + sceneBounds.height * 0.72);
	await page.mouse.down();
	await page.mouse.move(sceneBounds.x + sceneBounds.width * 0.665, sceneBounds.y + sceneBounds.height * 0.72);
	await page.mouse.up();

	await tester.step('orbit-inspection', {
		description: 'Inspection mode orbits the unified 3D game surface',
		verifications: [
			{
				spec: 'One canvas contains all rack and table fields plus both player labels',
				check: async () => {
					await expect(unifiedScene).toHaveAttribute('data-field-count', '4');
					await expect(unifiedScene).toHaveAttribute('data-player-label-count', '2');
					await expect(inspectableCanvas).toHaveCount(1);
				}
			},
			{
				spec: 'The drawing buffer matches the capped device pixel ratio',
				check: async () => {
					const resolution = await inspectableCanvas.evaluate((canvas: HTMLCanvasElement) => ({
						bufferWidth: canvas.width,
						cssWidth: canvas.clientWidth,
						expectedDpr: Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
					}));
					expect(resolution.bufferWidth).toBe(Math.round(resolution.cssWidth * resolution.expectedDpr));
				}
			},
			{
				spec: 'Inspection mode remains visibly active until the player exits it',
				check: async () => await expect(page.getByRole('button', { name: 'Exit 3D' })).toHaveAttribute('aria-pressed', 'true')
			}
		]
	});

	tester.generateDocs();
});
