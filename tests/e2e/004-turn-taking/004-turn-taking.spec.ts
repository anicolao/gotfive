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

		const suffix = 'deterministic';
		const hostId = `turn-taking-host-${suffix}`;
		const clientId = `turn-taking-client-${suffix}`;
		const lobbyId = `lobby-004-1-${suffix}`;

		// 1. Setup Lobby
		await hostPage.goto(`/?seed=123&myId=${hostId}&lobbyId=${lobbyId}&hostGameId=TURNZ`);
		await hostPage.getByLabel('Your Name:').fill('Host');
		await hostPage.getByRole('button', { name: 'Join Lobby' }).click();
		await hostPage.getByRole('button', { name: 'Host New Game' }).click();
		await hostPage.getByRole('button', { name: 'Start Hosting' }).click();
		
		const gameId = (await hostPage.locator('code').innerText()).trim();
		
		await clientPage.goto(`/?seed=123&myId=${clientId}&lobbyId=${lobbyId}&gameId=${gameId}`);
		await clientPage.getByLabel('Your Name:').fill('Client');
		await clientPage.getByRole('button', { name: 'Join Lobby' }).click();

		// Wait for connection - Host should see "Connected Players (2)"
		await expect(hostPage.getByText('Connected Players (2)')).toBeVisible();
		await expect(clientPage.getByText('Connected to Host!')).toBeVisible();

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

		const observerContext = await browser.newContext();
		const observerPage = await observerContext.newPage();
		await observerPage.goto(`/?seed=123&lobbyId=${lobbyId}&gameId=${gameId}`);
		await expect(observerPage.locator('.main-play-area')).toBeVisible();
		await expect(observerPage.locator('.stand-container').filter({ hasText: 'Host' })).toBeVisible();
		await expect(observerPage.locator('.stand-container').filter({ hasText: 'Client' })).toBeVisible();

		// Check whose turn it is
		let hostIsCurrent = await hostPage.locator('.stand-container.current-turn').filter({ hasText: 'Host' }).count() > 0;
		console.log('Is Host current turn?', hostIsCurrent);
		
		const currentPlayerPage = hostIsCurrent ? hostPage : clientPage;
		const otherPlayerPage = hostIsCurrent ? clientPage : hostPage;
		const otherPlayerName = hostIsCurrent ? 'Client' : 'Host';
		await expect(currentPlayerPage.locator('.deck-btn.red')).toBeEnabled();
		await expect(otherPlayerPage.locator('.deck-btn.red')).toBeDisabled();
		await expect(currentPlayerPage.locator('.deduction-board .got-five-btn')).toBeDisabled();

		await tester.step('game-started', {
			description: 'Game started and current turn is indicated',
			verifications: [
				{ spec: 'Current turn indicator is visible', check: async () => await expect(hostPage.locator('.stand-container.current-turn')).toBeVisible() }
			]
		});

		const otherInputs = await otherPlayerPage.locator('.guess-inputs input').all();
		for (const input of otherInputs) {
			await input.fill('1');
		}
		await expect(otherPlayerPage.locator('.deduction-board .got-five-btn')).toBeEnabled();
		for (const input of otherInputs) {
			await input.fill('');
		}

		// Now eliminate the current player
		console.log('Eliminating current player...');

		// Fill in some wrong guess
		await currentPlayerPage.locator('.deck-btn.red').click();
		await expect(currentPlayerPage.locator('.deck-btn.red')).toBeDisabled();
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

		await clientPage.evaluate(() => {
			const store = (window as any).store;
			store.dispatch({ type: 'ui/markDeduction', payload: { id: 1, mark: 'X' } });
			store.dispatch({ type: 'ui/markDeduction', payload: { id: 6, mark: 'OK' } });
			store.dispatch({ type: 'ui/addStroke', payload: [[1, 1], [12, 12]] });
		});
		const clientGuessInputs = clientPage.locator('.deduction-board .guess-inputs input');
		for (let i = 0; i < 5; i++) {
			await clientGuessInputs.nth(i).fill(`${i + 1}`);
		}
		await expect(clientPage.locator('.deduction-board .strike')).toHaveCount(1);
		await expect(clientPage.locator('.deduction-board .check')).toHaveCount(1);
		await expect(clientGuessInputs.nth(0)).toHaveValue('1');

		await clientPage.locator('.status-banner button:has-text("Play Again")').click();
		await expect(hostPage.locator('.status-banner.finished')).not.toBeVisible();
		await expect(clientPage.locator('.status-banner.finished')).not.toBeVisible();
		await expect(clientPage.locator('.stand-container').filter({ hasText: 'Client' }).locator('.tile')).toHaveCount(5);

		await expect(clientPage.locator('.deduction-board .strike')).toHaveCount(0);
		await expect(clientPage.locator('.deduction-board .check')).toHaveCount(0);
		for (let i = 0; i < 5; i++) {
			await expect(clientGuessInputs.nth(i)).toHaveValue('');
		}

		tester.generateDocs();
		
		await hostContext.close();
		await clientContext.close();
		await observerContext.close();
	});
});
