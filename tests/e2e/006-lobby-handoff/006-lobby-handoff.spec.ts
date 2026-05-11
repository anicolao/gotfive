import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Lobby Leader Handoff', () => {
	test('should hand off leadership to the senior client when the leader leaves', async ({ browser }, testInfo) => {
		const lobbyId = `handoff-seniority-deterministic`;
		
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		const context3 = await browser.newContext();

		const p1 = await context1.newPage();
		const p2 = await context2.newPage();
		const p3 = await context3.newPage();

		const tester = new TestStepHelper(p2, testInfo);
		tester.setMetadata('Lobby Leader Handoff', 'Testing that leadership is handed off correctly based on seniority.');

		const suffix = 'seniority';
		const id1 = `p1-${suffix}`;
		const id2 = `p2-${suffix}`;
		const id3 = `p3-${suffix}`;

		// 1. P1 joins (becomes leader)
		await p1.goto(`/?myId=${id1}&lobbyId=${lobbyId}`);
		await p1.getByLabel('Your Name:').fill('Player 1');
		await p1.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p1.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 15000 });

		// 2. P2 joins
		await p2.goto(`/?myId=${id2}&lobbyId=${lobbyId}`);
		await p2.getByLabel('Your Name:').fill('Player 2');
		await p2.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p2.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 15000 });

		// 3. P3 joins
		await p3.goto(`/?myId=${id3}&lobbyId=${lobbyId}`);
		await p3.getByLabel('Your Name:').fill('Player 3');
		await p3.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p3.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 15000 });

		// Verify all see each other
		await expect(p2.locator('.players-list').getByText('Player 1')).toBeVisible();
		await expect(p2.locator('.players-list').getByText('Player 3')).toBeVisible();

		await tester.step('initial-state', {
			description: 'Three players in lobby, P1 is leader',
			verifications: [
				{ spec: 'P2 is client', check: async () => await expect(p2.getByText('LOBBY_CLIENT')).toBeVisible() },
				{ spec: 'P1 is visible in list', check: async () => await expect(p2.locator('.players-list').getByText('Player 1')).toBeVisible() }
			],
            networkStatus: 'skip'
		});

		// 4. P1 leaves (closes page)
		await p1.close();

		// 5. P2 should become leader (seniority)
		await expect(p2.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 60000 });
		
		await tester.step('p2-becomes-leader', {
			description: 'P2 becomes leader after P1 leaves',
			verifications: [
				{ spec: 'P2 is now leader', check: async () => await expect(p2.getByText('LOBBY_LEADER')).toBeVisible() },
				{ spec: 'P3 is still visible', check: async () => await expect(p2.locator('.players-list').getByText('Player 3')).toBeVisible() }
			],
            networkStatus: 'skip'
		});

		// 6. P3 should still be a client and connected to P2
		await expect(p3.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 60000 });
		await expect(p3.locator('.players-list').getByText('Player 2')).toBeVisible();

		tester.generateDocs();
		
		await context1.close();
		await context2.close();
		await context3.close();
	});

	test('should hand off leadership correctly even if a newcomer arrives during handoff', async ({ browser }, testInfo) => {
		const lobbyId = `handoff-newcomer-deterministic`;
		
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		const context4 = await browser.newContext();

		const p1 = await context1.newPage();
		const p2 = await context2.newPage();
		const p4 = await context4.newPage();

		const tester = new TestStepHelper(p2, testInfo);
		tester.setMetadata('Lobby Leader Handoff with Newcomer', 'Testing that a newcomer does not steal leadership during handoff.');

		const suffix = 'newcomer';
		const id1 = `p1-${suffix}`;
		const id2 = `p2-${suffix}`;
		const id4 = `p4-${suffix}`;

		// 1. P1 joins (leader)
		await p1.goto(`/?myId=${id1}&lobbyId=${lobbyId}`);
		await p1.getByLabel('Your Name:').fill('Player 1');
		await p1.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p1.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 15000 });

		// 2. P2 joins
		await p2.goto(`/?myId=${id2}&lobbyId=${lobbyId}`);
		await p2.getByLabel('Your Name:').fill('Player 2');
		await p2.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p2.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 15000 });

		// 3. P1 leaves
		await p1.close();

		// 4. Simultaneously (almost), P4 joins
		// Give P2 a bit of a head start on the disconnection
		await p2.waitForTimeout(500);

		await p4.goto(`/?myId=${id4}&lobbyId=${lobbyId}`);
		await p4.getByLabel('Your Name:').fill('Player 4');
		await p4.getByRole('button', { name: 'Join Lobby' }).click();

		// 5. P2 should still become leader because it was already in the lobby
		await expect(p2.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 60000 });
		
		await tester.step('p2-leader-despite-newcomer', {
			description: 'P2 becomes leader even with P4 joining',
			verifications: [
				{ spec: 'P2 is leader', check: async () => await expect(p2.getByText('LOBBY_LEADER')).toBeVisible() }
			],
            networkStatus: 'skip'
		});

		await context1.close();
		await context2.close();
		await context4.close();
	});

	test('should keep playing players in lobby and allow them to become leader', async ({ browser }, testInfo) => {
		const lobbyId = `playing-leader-deterministic`;
		
		const context1 = await browser.newContext();
		const context2 = await browser.newContext();
		const context3 = await browser.newContext();

		const p1 = await context1.newPage();
		const p2 = await context2.newPage();
		const p3 = await context3.newPage();

		const tester = new TestStepHelper(p2, testInfo);
		tester.setMetadata('Playing Player as Lobby Leader', 'Testing that players staying in lobby while playing can become leaders.');

		const suffix = 'playing';
		const id1 = `p1-${suffix}`;
		const id2 = `p2-${suffix}`;
		const id3 = `p3-${suffix}`;

		// 1. P1 joins (leader)
		await p1.goto(`/?myId=${id1}&lobbyId=${lobbyId}`);
		await p1.getByLabel('Your Name:').fill('Player 1');
		await p1.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p1.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 15000 });

		// 2. P2 joins
		await p2.goto(`/?myId=${id2}&lobbyId=${lobbyId}`);
		await p2.getByLabel('Your Name:').fill('Player 2');
		await p2.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p2.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 15000 });

		// 3. P3 joins
		await p3.goto(`/?myId=${id3}&lobbyId=${lobbyId}`);
		await p3.getByLabel('Your Name:').fill('Player 3');
		await p3.getByRole('button', { name: 'Join Lobby' }).click();
		await expect(p3.getByText('LOBBY_CLIENT')).toBeVisible({ timeout: 15000 });

		// 4. P2 starts hosting a game
		await p2.getByRole('button', { name: 'Host New Game' }).click();
		await p2.getByRole('button', { name: 'Start Hosting' }).click();
		await expect(p2.getByText('Your Game ID')).toBeVisible();

		// 5. Verify P2 is still visible in P3's lobby list
		await expect(p3.locator('.players-list').getByText('Player 2')).toBeVisible();

		await tester.step('p2-playing-visible', {
			description: 'P2 is hosting/playing but still visible in lobby',
			verifications: [
				{ spec: 'P2 visible in P3 lobby', check: async () => await expect(p3.locator('.players-list').getByText('Player 2')).toBeVisible() }
			],
            networkStatus: 'skip'
		});

		// 6. P1 leaves
		await p1.close();

		// 7. P2 should become leader even though it is in "HOSTING" mode
		await expect(p2.getByText('LOBBY_LEADER')).toBeVisible({ timeout: 60000 });
		
		await tester.step('p2-playing-becomes-leader', {
			description: 'P2 becomes leader while hosting',
			verifications: [
				{ spec: 'P2 is leader', check: async () => await expect(p2.getByText('LOBBY_LEADER')).toBeVisible() }
			],
            networkStatus: 'skip'
		});

		await context1.close();
		await context2.close();
		await context3.close();
	});
});
