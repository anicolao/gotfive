import { test, expect } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Homepage loads correctly", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);

	await page.goto("/");

	await helper.step("initial-load", {
		description: "The homepage should load with the correct title.",
		verifications: [
			{
				spec: "Page title contains 'Got Five!'",
				check: async () => {
					await expect(page).toHaveTitle(/Got Five!/);
				},
			},
			{
				spec: "'Get started' text is visible",
				check: async () => {
					await expect(page.getByText("Get started")).toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
