import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Multiplayer Lobby', () => {
	test('should show lobby on initial load', async ({ page }, testInfo) => {
		const tester = new TestStepHelper(page, testInfo);
		tester.setMetadata('Multiplayer Lobby', 'Testing the initial lobby state.');

		await page.goto(`/?seed=123&myId=multiplayer-lobby-test-user`);
		
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

		await page.goto(`/?seed=123&myId=multiplayer-hosting-test-user`);
		
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
});
