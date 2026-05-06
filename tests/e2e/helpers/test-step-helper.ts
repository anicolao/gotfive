import { type Page, type TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface Verification {
    spec: string;
    check: () => Promise<void>;
}

export interface StepOptions {
    description: string;
    verifications: Verification[];
    networkStatus?: 'synced' | 'offline' | 'error' | 'skip';
}

interface DocStep {
    title: string;
    image: string;
    specs: string[];
}

export async function waitForAnimations(page: Page) {
    await page.evaluate(() => {
        return Promise.all(
            document.getAnimations().map(animation => animation.finished)
        );
    });
}

export class TestStepHelper {
    private stepCount = 0;
    private steps: DocStep[] = [];
    private metadataTitle = '';
    private metadataDescription = '';

    constructor(private page: Page, private testInfo: TestInfo) { }

    setMetadata(title: string, description: string) {
        this.metadataTitle = title;
        this.metadataDescription = description;
    }

    async step(id: string, options: StepOptions) {
        // 1. Run Verification
        for (const v of options.verifications) {
            await v.check();
        }

        // 2. Generate Name
        const paddedIndex = String(this.stepCount++).padStart(3, '0');
        const filename = `${paddedIndex}-${id.replace(/_/g, '-')}.png`;

        // 3. Stabilization: Wait for Network Sync (if present)
        const networkStatus = this.page.locator('button[data-status]:visible');
        const expectedStatus = options.networkStatus ?? 'synced';
        if (expectedStatus !== 'skip') {
            const statusVisible = await networkStatus.first()
                .waitFor({ state: 'visible', timeout: 5000 })
                .then(() => true)
                .catch(() => false);
            if (statusVisible) {
                await expect(networkStatus.first()).toHaveAttribute('data-status', expectedStatus, { timeout: 30000 });
            }
        }

        await waitForAnimations(this.page);

        // 4. Capture & Verify (Zero-Pixel Tolerance)
        await expect(this.page).toHaveScreenshot(filename.replace(/\.png$/, ''), {
            mask: [this.page.locator('.version-info')]
        });

        // 5. Record for Docs
        this.steps.push({
            title: options.description,
            image: `./screenshots/${filename}`,
            specs: options.verifications.map(v => v.spec)
        });
    }

    generateDocs() {
        const testDir = path.dirname(this.testInfo.file);
        const readmePath = path.join(testDir, 'README.md');

        let content = `# ${this.metadataTitle}\n\n${this.metadataDescription}\n\n`;

        for (const step of this.steps) {
            content += `## ${step.title}\n\n`;
            content += `![${step.title}](${step.image})\n\n`;
            content += `**Verifications:**\n`;
            for (const spec of step.specs) {
                content += `- [x] ${spec}\n`;
            }
            content += `\n---\n\n`;
        }

        fs.writeFileSync(readmePath, content);
    }
}
