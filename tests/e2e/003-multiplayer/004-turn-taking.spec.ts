import { test, expect } from '@playwright/test';

test.describe('Multiplayer Turn-Taking', () => {
	test('should rotate turns and handle elimination', async ({ browser }) => {
		const hostContext = await browser.newContext();
		const clientContext = await browser.newContext();

		const hostPage = await hostContext.newPage();
		const clientPage = await clientContext.newPage();

		// Host joins
		await hostPage.goto('/');
		await hostPage.getByLabel('Your Name:').fill('Host');
		await hostPage.getByRole('button', { name: 'Host Game' }).click();
		
		const hostId = await hostPage.locator('code').innerText();

		// Client joins
		await clientPage.goto('/');
		await clientPage.getByLabel('Your Name:').fill('Client');
		await clientPage.getByRole('button', { name: 'Join Game' }).click();
		await clientPage.getByLabel('Enter Host Game ID:').fill(hostId);
		await clientPage.getByRole('button', { name: 'Connect' }).click();

		// Wait for connection - Host should see "Connected Players (2)"
		await expect(hostPage.getByText('Connected Players (2)')).toBeVisible({ timeout: 10000 });
		await expect(clientPage.getByText('Connected to Host!')).toBeVisible({ timeout: 10000 });
		
		// Host starts game
		await hostPage.getByRole('button', { name: 'START GAME' }).click();

		// Wait for game to start on both pages
		await expect(hostPage.getByText('Current Turn:')).toBeVisible();
		await expect(clientPage.getByText('Current Turn:')).toBeVisible();

		// Check whose turn it is
		let turnText = await hostPage.locator('.turn-indicator .player-name').innerText();
		console.log('Initial turn:', turnText);
		
		if (turnText === 'Host') {
			await expect(hostPage.getByText('YOUR TURN!')).toBeVisible();
			await hostPage.getByRole('button', { name: 'Pass Turn' }).click();
			await expect(hostPage.locator('.turn-indicator .player-name')).toHaveText('Client');
		} else {
			await expect(clientPage.getByText('YOUR TURN!')).toBeVisible();
			await clientPage.getByRole('button', { name: 'Pass Turn' }).click();
			await expect(clientPage.locator('.turn-indicator .player-name')).toHaveText('Host');
		}

		// Now eliminate the current player
		const currentTurnName = await hostPage.locator('.turn-indicator .player-name').innerText();
		const currentPlayerPage = currentTurnName === 'Host' ? hostPage : clientPage;
		const otherPlayerPage = currentTurnName === 'Host' ? clientPage : hostPage;
		const otherPlayerName = currentTurnName === 'Host' ? 'Client' : 'Host';

		console.log('Eliminating player:', currentTurnName);

		// Fill in some wrong guess
		const inputs = await currentPlayerPage.locator('.guess-inputs input').all();
		for (const input of inputs) {
			await input.fill('1');
		}
		await currentPlayerPage.getByRole('button', { name: 'GOT FIVE!' }).click();

		// Should show game over
		await expect(currentPlayerPage.getByText('GAME OVER')).toBeVisible();
		await expect(currentPlayerPage.locator('.end-game-modal').getByText('Winner: ' + otherPlayerName + '!')).toBeVisible();
		
		// The other player should also see they won
		await expect(otherPlayerPage.getByText('GAME OVER')).toBeVisible();
		await expect(otherPlayerPage.locator('.end-game-modal').getByText('Winner: ' + otherPlayerName + '!')).toBeVisible();
		
		await hostContext.close();
		await clientContext.close();
	});
});
