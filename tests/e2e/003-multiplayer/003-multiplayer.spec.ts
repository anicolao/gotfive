import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Multiplayer Lobby', () => {
	test('should show lobby on initial load', async ({ page }, testInfo) => {
		const tester = new TestStepHelper(page, testInfo);
		tester.setMetadata('Multiplayer Lobby', 'Testing the initial lobby state.');

		await page.goto(`/?seed=123&myId=multiplayer-lobby-test-user&lobbyId=lobby-003-1`);
		
		await tester.step('initial-lobby', {
			description: 'Lobby is visible',
			verifications: [
				{ spec: 'Lobby header is visible', check: async () => await expect(page.getByRole('heading', { name: 'Got Five! Lobby' })).toBeVisible() },
				{ spec: 'Name input is visible', check: async () => await expect(page.getByLabel('Your Name:')).toBeVisible() },
				{ spec: 'Join Lobby button is visible', check: async () => await expect(page.getByRole('button', { name: 'Join Lobby' })).toBeVisible() }
			]
		});

		tester.generateDocs();
	});

	test('should show hosting instructions after clicking Host Game', async ({ page }, testInfo) => {
		const tester = new TestStepHelper(page, testInfo);
		tester.setMetadata('Hosting Lobby', 'Testing the hosting flow.');

		await page.goto(`/?seed=123&myId=multiplayer-hosting-test-user&lobbyId=lobby-003-2`);
		
		await page.getByLabel('Your Name:').fill('Tester');
		await page.getByRole('button', { name: 'Join Lobby' }).click();
		await page.getByRole('button', { name: 'Host New Game' }).click();
		await page.getByRole('button', { name: 'Start Hosting' }).click();
		
		await tester.step('hosting-flow', {
			description: 'Hosting instructions are visible',
			verifications: [
				{ spec: 'Game ID is visible', check: async () => await expect(page.getByText('Your Game ID')).toBeVisible() },
				{ spec: 'Copy button is visible', check: async () => await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible() }
			]
		});

		tester.generateDocs();
	});

	test('should allow a client to join a public game from the lobby', async ({ browser }, testInfo) => {
		const hostContext = await browser.newContext();
		const clientContext = await browser.newContext();
		const hostPage = await hostContext.newPage();
		const clientPage = await clientContext.newPage();

		const tester = new TestStepHelper(clientPage, testInfo);
		tester.setMetadata('Public Game Lobby', 'Testing public game discovery and joining.');

		const suffix = 'deterministic';
		const hostId = `public-host-${suffix}`;
		const clientId = `public-client-${suffix}`;
		const lobbyId = `lobby-003-3-${suffix}`;

		// 1. Setup Host
		await hostPage.goto(`/?seed=123&myId=${hostId}&lobbyId=${lobbyId}`);
		await hostPage.getByLabel('Your Name:').fill('Host');
		await hostPage.getByRole('button', { name: 'Join Lobby' }).click();
		
		// Wait for Host to connect to Lobby
		await expect(hostPage.getByText('LOBBY_LEADER')).toBeVisible();

		await hostPage.getByRole('button', { name: 'Host New Game' }).click();
		await hostPage.getByLabel('Game Name:').fill("Host's Public Game");
		await hostPage.getByLabel('Visibility:').selectOption('public');
		await hostPage.getByRole('button', { name: 'Start Hosting' }).click();
		
		await expect(hostPage.getByText('Your Game ID')).toBeVisible();

		// 2. Setup Client
		await clientPage.goto(`/?seed=123&myId=${clientId}&lobbyId=${lobbyId}`);
		await clientPage.getByLabel('Your Name:').fill('Client');
		await clientPage.getByRole('button', { name: 'Join Lobby' }).click();
		
		// Wait for Client to connect to Lobby
		await expect(clientPage.getByText('LOBBY_CLIENT')).toBeVisible();

		// 3. Client checks for Public Game
		await expect(clientPage.getByRole('heading', { name: 'Public Games' })).toBeVisible();
		const gameCard = clientPage.locator('.game-card').filter({ hasText: "Host's Public Game" });
		await expect(gameCard).toBeVisible();

		await tester.step('public-game-visible', {
			description: 'Public game is visible in the lobby',
			verifications: [
				{ spec: 'Game card is visible', check: async () => await expect(gameCard).toBeVisible() }
			]
		});

		// 4. Client joins the game
		await gameCard.getByRole('button', { name: 'Join' }).click();

		// 5. Client verifies connection
		await expect(clientPage.getByText('Connected to Host!')).toBeVisible();
		await expect(hostPage.getByText('Client')).toBeVisible();

		await tester.step('client-connected', {
			description: 'Client successfully connected to the host',
			verifications: [
				{ spec: 'Connection message visible', check: async () => await expect(clientPage.getByText('Connected to Host!')).toBeVisible() }
			]
		});

		tester.generateDocs();
		
		await hostContext.close();
		await clientContext.close();
	});
});
