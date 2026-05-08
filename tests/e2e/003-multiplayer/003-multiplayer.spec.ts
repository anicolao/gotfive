import { test, expect } from '@playwright/test';

test.describe('Multiplayer Lobby', () => {
	test('should show lobby on initial load', async ({ page }) => {
		await page.goto('/');
		
		// Wait for the lobby to appear
		const lobbyHeader = page.getByRole('heading', { name: 'Lobby' });
		await expect(lobbyHeader).toBeVisible();
		
		const nameInput = page.getByLabel('Your Name:');
		await expect(nameInput).toBeVisible();
		
		const hostButton = page.getByRole('button', { name: 'Host Game' });
		const joinButton = page.getByRole('button', { name: 'Join Game' });
		
		await expect(hostButton).toBeVisible();
		await expect(joinButton).toBeVisible();
	});

	test('should show hosting instructions after clicking Host Game', async ({ page }) => {
		await page.goto('/');
		
		await page.getByLabel('Your Name:').fill('Tester');
		await page.getByRole('button', { name: 'Host Game' }).click();
		
		await expect(page.getByText('Your Game ID')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
	});
});
