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
            document.getAnimations()
                .filter(animation => {
                    const timing = animation.effect?.getTiming();
                    return timing?.iterations !== Infinity && timing?.duration !== 'infinite';
                })
                .map(animation => animation.finished)
        );
    });
}

export async function checkNoClippingOrOverlap(page: Page) {
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('.tile, .stand, .deduction-board, .table, .lobby, .mini-tile, input, button:not(.cell)'));
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            
            // Check clipping (allow 10px tolerance for mobile)
            if (rect.left < -10 || rect.top < -10 || rect.right > viewWidth + 10 || rect.bottom > viewHeight + 10) {
                // If the element is hidden or zero-sized, it's fine
                if (rect.width === 0 || rect.height === 0) continue;
                
                throw new Error(`Element ${el.className} (${el.tagName}) is clipped: ${JSON.stringify(rect)} vs viewport ${viewWidth}x${viewHeight}`);
            }

            // Check overlap
            for (const other of elements) {
                if (el === other) continue;
                const otherRect = other.getBoundingClientRect();
                
                // If either is hidden, skip
                if (rect.width === 0 || rect.height === 0 || otherRect.width === 0 || otherRect.height === 0) continue;

                // Allow 10px tolerance for overlaps on mobile
                const overlap = !(rect.right <= otherRect.left + 10 || 
                                  rect.left >= otherRect.right - 10 || 
                                  rect.bottom <= otherRect.top + 10 || 
                                  rect.top >= otherRect.bottom - 10);
                
                if (overlap) {
                    // Check if one is a child of the other, which is fine
                    if (el.contains(other) || other.contains(el)) continue;
                    
                    // Also some overlays are expected (like the canvas on deduction board)
                    if (el.tagName === 'CANVAS' || other.tagName === 'CANVAS') continue;
                    
                    // Ignore overlaps with status-banner as it might overlay during end-game
                    if (el.classList.contains('status-banner') || other.classList.contains('status-banner')) continue;

                    // Allow some overlap between table and stands on mobile as they are large components
                    const isTable = el.closest('.table') || other.closest('.table');
                    const isStand = el.closest('.stand-container') || other.closest('.stand-container');
                    
                    if (isTable && isStand) {
                        // If they overlap by less than 100px, it's acceptable on mobile
                        const overlapAmount = Math.max(0, Math.min(rect.bottom, otherRect.bottom) - Math.max(rect.top, otherRect.top));
                        if (overlapAmount < 100) continue;
                    }

                    throw new Error(`Element ${el.className} (${el.tagName}) overlaps with ${other.className} (${other.tagName})\nRect 1: ${JSON.stringify(rect)}\nRect 2: ${JSON.stringify(otherRect)}`);
                }
            }
        }
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
        
        // 4. Check for clipping and overlap
        await checkNoClippingOrOverlap(this.page);

        // 5. Capture & Verify (Zero-Pixel Tolerance)
        await expect(this.page).toHaveScreenshot(filename.replace(/\.png$/, ''), {
            mask: [this.page.locator('.version-info')]
        });

        // 6. Record for Docs
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
