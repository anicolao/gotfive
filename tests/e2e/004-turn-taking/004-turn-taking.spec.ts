import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Multiplayer Turn-Taking', () => {
	test('should rotate turns and handle elimination', async ({ browser }, testInfo) => {
		const hostContext = await browser.newContext();
		const clientContext = await browser.newContext();
		const hostPage = await hostContext.newPage();
		const clientPage = await clientContext.newPage();

		const tester = new TestStepHelper(hostPage, testInfo);
		tester.setMetadata('Multiplayer Turn-Taking', 'Testing turn rotation and elimination in multiplayer.');

		// 1. Setup Lobby
		await hostPage.goto('/?seed=123');
		await hostPage.getByLabel('Your Name:').fill('Host');
		await hostPage.getByRole('button', { name: 'Host Game' }).click();
		
		const gameId = (await hostPage.locator('code').innerText()).trim();
		
		await clientPage.goto('/?seed=123');
		await clientPage.getByLabel('Your Name:').fill('Client');
		await clientPage.getByRole('button', { name: 'Join Game' }).click();
		await clientPage.getByLabel('Enter Host Game ID:').fill(gameId);
		await clientPage.getByRole('button', { name: 'Connect' }).click();

		// Wait for connection - Host should see "Connected Players (2)"
		await expect(hostPage.getByText('Connected Players (2)')).toBeVisible({ timeout: 10000 });
		await expect(clientPage.getByText('Connected to Host!')).toBeVisible({ timeout: 10000 });

		await tester.step('lobby-connected', {
			description: 'Players are connected in lobby',
			verifications: [
				{ spec: 'Host sees 2 players', check: async () => await expect(hostPage.getByText('Connected Players (2)')).toBeVisible() }
			]
		});

		// Host starts game
		await hostPage.getByRole('button', { name: 'START GAME' }).click();

		// Wait for game to start on both pages
		await expect(hostPage.locator('.stand-container.current-turn')).toBeVisible();
		await expect(clientPage.locator('.stand-container.current-turn')).toBeVisible();

		// Check whose turn it is
		let hostIsCurrent = await hostPage.locator('.stand-container.current-turn').filter({ hasText: 'Host' }).count() > 0;
		console.log('Is Host current turn?', hostIsCurrent);
		
		const currentPlayerPage = hostIsCurrent ? hostPage : clientPage;
		const otherPlayerPage = hostIsCurrent ? clientPage : hostPage;
		const otherPlayerName = hostIsCurrent ? 'Client' : 'Host';

		await tester.step('game-started', {
			description: 'Game started and current turn is indicated',
			verifications: [
				{ spec: 'Current turn indicator is visible', check: async () => await expect(hostPage.locator('.stand-container.current-turn')).toBeVisible() }
			]
		});

		// Now eliminate the current player
		console.log('Eliminating current player...');

		// Fill in some wrong guess
		const inputs = await currentPlayerPage.locator('.guess-inputs input').all();
		for (const input of inputs) {
			await input.fill('1');
		}
		await currentPlayerPage.getByRole('button', { name: 'GOT FIVE!' }).click();

		// Should show game over
		await expect(currentPlayerPage.locator('.status-banner')).toBeVisible();
		await expect(currentPlayerPage.locator('.status-banner').getByText('Winner: ' + otherPlayerName + '!')).toBeVisible();
		
		// The other player should also see they won
		await expect(otherPlayerPage.locator('.status-banner')).toBeVisible();
		await expect(otherPlayerPage.locator('.status-banner').getByText('Winner: ' + otherPlayerName + '!')).toBeVisible();

		await tester.step('game-over-multiplayer', {
			description: 'Game over state shown for both players',
			verifications: [
				{ spec: 'Winner is announced', check: async () => await expect(hostPage.locator('.status-banner').getByText('Winner: ')).toBeVisible() }
			]
		});

		tester.generateDocs();
		
		await hostContext.close();
		await clientContext.close();
	});
});
