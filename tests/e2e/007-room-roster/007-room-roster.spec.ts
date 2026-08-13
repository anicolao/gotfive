import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Room roster isolation', () => {
	test('should not carry a player from a previous game into a new room', async ({ browser }, testInfo) => {
		const lobbyId = 'lobby-007-room-roster';
		const hostContext = await browser.newContext();
		const annaContext = await browser.newContext();
		const host = await hostContext.newPage();
		const anna = await annaContext.newPage();
		const tester = new TestStepHelper(host, testInfo);
		tester.setMetadata(
			'Room Roster Isolation',
			'Testing that a new room starts with only players who joined that room.'
		);

		await host.goto(`/?seed=123&myId=roster-host&lobbyId=${lobbyId}&hostGameId=OLDGM`);
		await host.getByLabel('Your Name:').fill('Host');
		await host.getByRole('button', { name: 'Join Lobby' }).click();
		await host.getByRole('button', { name: 'Host New Game' }).click();
		await host.getByRole('button', { name: 'Start Hosting' }).click();
		await expect(host.getByText('Your Game ID')).toBeVisible();

		await anna.goto(`/?seed=123&myId=roster-anna&lobbyId=${lobbyId}`);
		await anna.getByLabel('Your Name:').fill('Anna');
		await anna.getByRole('button', { name: 'Join Lobby' }).click();
		const oldGame = anna.locator('.game-card').filter({ hasText: "Host's Game" });
		await oldGame.getByRole('button', { name: 'Join' }).click();
		await expect(host.getByText('Connected Players (2)')).toBeVisible();

		await host.getByRole('button', { name: 'START GAME' }).click();
		await expect(host.locator('.opponents-area').getByText('Anna', { exact: true })).toBeVisible();

		await host.getByRole('button', { name: 'Back to Lobby' }).click();
		await expect(host.getByRole('button', { name: 'Host New Game' })).toBeVisible();
		await host.evaluate(() => {
			const url = new URL(window.location.href);
			url.searchParams.set('hostGameId', 'NEWGM');
			window.history.replaceState({}, '', url);
		});

		await host.getByRole('button', { name: 'Host New Game' }).click();
		await host.getByRole('button', { name: 'Start Hosting' }).click();
		await expect(host.getByText('Connected Players (1)')).toBeVisible();
		await host.getByRole('button', { name: 'START GAME' }).click();
		await expect(host.locator('.main-play-area')).toBeVisible();

		await tester.step('new-room-excludes-previous-player', {
			description: 'A new room starts without a player from the previous game',
			verifications: [
				{
					spec: 'Anna is absent from the new game',
					check: async () => await expect(host.locator('.opponents-area').getByText('Anna', { exact: true })).toHaveCount(0)
				},
				{
					spec: 'Only the host is in the new game roster',
					check: async () => {
						const playerNames = await host.evaluate(() => {
							const state = (window as any).store.getState();
							return Object.values(state.players.players).map((player: any) => player.name);
						});
						expect(playerNames).toEqual(['Host']);
					}
				}
			]
		});

		tester.generateDocs();
		await hostContext.close();
		await annaContext.close();
	});
});
