import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Firebase Lobby Event Replay', () => {
	test('should project multiple lobby players from the shared event stream', async ({ browser }, testInfo) => {
		const lobbyId = `event-replay-multi-player`;
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		const context3 = await browser.newContext();

		const p1 = await context1.newPage();
		const p2 = await context2.newPage();
		const p3 = await context3.newPage();

		const tester = new TestStepHelper(p2, testInfo);
		tester.setMetadata('Firebase Lobby Event Replay', 'Testing that clients replay lobby events into the same projected state.');

		await p1.goto(`/?myId=p1-event&lobbyId=${lobbyId}`);
		await p1.getByLabel('Your Name:').fill('Player 1');
		await p1.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p1.getByRole('button', { name: 'Host New Game' })).toBeVisible();

		await p2.goto(`/?myId=p2-event&lobbyId=${lobbyId}`);
		await p2.getByLabel('Your Name:').fill('Player 2');
		await p2.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p2.getByRole('button', { name: 'Host New Game' })).toBeVisible();

		await p3.goto(`/?myId=p3-event&lobbyId=${lobbyId}`);
		await p3.getByLabel('Your Name:').fill('Player 3');
		await p3.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p3.getByRole('button', { name: 'Host New Game' })).toBeVisible();

		await expect(p2.locator('.players-list').getByText('Player 1')).toBeVisible();
		await expect(p2.locator('.players-list').getByText('Player 3')).toBeVisible();
		await expect(p2.locator('.players-list li')).toHaveText([
			'Player 2 (You)',
			'Player 3',
			'Player 1'
		]);

		await tester.step('initial-state', {
			description: 'Three players are projected from lobby events',
			verifications: [
				{ spec: 'P2 is in the lobby', check: async () => await expect(p2.getByRole('button', { name: 'Host New Game' })).toBeVisible() },
				{ spec: 'P1 is visible in list', check: async () => await expect(p2.locator('.players-list').getByText('Player 1')).toBeVisible() },
				{ spec: 'P3 is visible in list', check: async () => await expect(p2.locator('.players-list').getByText('Player 3')).toBeVisible() }
			],
			networkStatus: 'skip'
		});

		tester.generateDocs();
		await context1.close();
		await context2.close();
		await context3.close();
	});

	test('should show games created before a later client joins', async ({ browser }, testInfo) => {
		const lobbyId = `event-replay-late-joiner`;
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const host = await context1.newPage();
		const lateJoiner = await context2.newPage();

		const tester = new TestStepHelper(lateJoiner, testInfo);
		tester.setMetadata('Firebase Lobby Event Replay with Newcomer', 'Testing that a newcomer replays existing game creation events.');

		await host.goto(`/?myId=host-event&lobbyId=${lobbyId}`);
		await host.getByLabel('Your Name:').fill('Host');
		await host.getByRole('button', { name: 'Join Lobby' }).click();
		await host.getByRole('button', { name: 'Host New Game' }).click();
		await host.getByLabel('Game Name:').fill('Replay Visible Game');
		await host.getByRole('button', { name: 'Start Hosting' }).click();
		await expect(host.getByText('Your Game ID')).toBeVisible();

		await lateJoiner.goto(`/?myId=late-event&lobbyId=${lobbyId}`);
		await lateJoiner.getByLabel('Your Name:').fill('Late Joiner');
		await lateJoiner.getByRole('button', { name: 'Join Lobby' }).click();

		const gameCard = lateJoiner.locator('.game-card').filter({ hasText: 'Replay Visible Game' });
		await expect(gameCard).toBeVisible();
		await expect(lateJoiner.locator('.players-list').getByText('Late Joiner')).toBeVisible();

		await tester.step('late-joiner-sees-game', {
			description: 'Late joiner sees existing public game',
			verifications: [
				{ spec: 'Game card is visible after replay', check: async () => await expect(gameCard).toBeVisible() },
				{ spec: 'Late joiner is visible in the lobby roster', check: async () => await expect(lateJoiner.locator('.players-list').getByText('Late Joiner')).toBeVisible() }
			],
			networkStatus: 'skip'
		});

		await context1.close();
		await context2.close();
	});

	test('should keep hosting players visible in the lobby projection', async ({ browser }, testInfo) => {
		const lobbyId = `event-replay-playing-visible`;
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();

		const host = await context1.newPage();
		const observer = await context2.newPage();

		const tester = new TestStepHelper(observer, testInfo);
		tester.setMetadata('Playing Player in Firebase Lobby', 'Testing that players in games remain visible through user and lobby event projection.');

		await host.goto(`/?myId=playing-host&lobbyId=${lobbyId}`);
		await host.getByLabel('Your Name:').fill('Playing Host');
		await host.getByRole('button', { name: 'Join Lobby' }).click();
		await host.getByRole('button', { name: 'Host New Game' }).click();
		await host.getByRole('button', { name: 'Start Hosting' }).click();
		await expect(host.getByText('Your Game ID')).toBeVisible();

		await observer.goto(`/?myId=observer&lobbyId=${lobbyId}`);
		await observer.getByLabel('Your Name:').fill('Observer');
		await observer.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(observer.locator('.players-list').getByText('Playing Host')).toBeVisible();
		await expect(observer.locator('.players-list').getByText('playing')).toBeVisible();

		await tester.step('playing-player-visible', {
			description: 'Hosting player remains visible in lobby',
			verifications: [
				{ spec: 'Playing host visible in observer lobby', check: async () => await expect(observer.locator('.players-list').getByText('Playing Host')).toBeVisible() }
			],
			networkStatus: 'skip'
		});

		await context1.close();
		await context2.close();
	});
});
