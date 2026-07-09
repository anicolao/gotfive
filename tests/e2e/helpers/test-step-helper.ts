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
        const getVisibleRect = (el: Element) => {
            let rect = el.getBoundingClientRect();
            let visibleRect = { 
                left: rect.left, 
                top: rect.top, 
                right: rect.right, 
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            };
            
            let current = el.parentElement;
            while (current && current !== document.body) {
                const style = window.getComputedStyle(current);
                if (style.overflow !== 'visible') {
                    const parentRect = current.getBoundingClientRect();
                    visibleRect.left = Math.max(visibleRect.left, parentRect.left);
                    visibleRect.top = Math.max(visibleRect.top, parentRect.top);
                    visibleRect.right = Math.min(visibleRect.right, parentRect.right);
                    visibleRect.bottom = Math.min(visibleRect.bottom, parentRect.bottom);
                }
                current = current.parentElement;
            }
            visibleRect.width = Math.max(0, visibleRect.right - visibleRect.left);
            visibleRect.height = Math.max(0, visibleRect.bottom - visibleRect.top);
            return visibleRect;
        };

        const elements = Array.from(document.querySelectorAll('.tile, .stand, .stand-container, .deduction-area, .deduction-board, .table, .lobby-wrapper, input, button:not(.cell), .player-area, .opponents-area, .public-area'));
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const visibleRect = getVisibleRect(el);
            
            // Check if the element is actually present and visible in the DOM
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            
            // Check parent clipping (allow 10px tolerance)
            const isClippedByParent = (
                rect.width - visibleRect.width > 10 ||
                rect.height - visibleRect.height > 10
            );

            if (isClippedByParent) {
                throw new Error(`Element ${el.className} (${el.tagName}) is clipped by a parent container (overflow hidden/scroll/auto).\nFull Rect: ${JSON.stringify(rect)}\nVisible Rect: ${JSON.stringify(visibleRect)}`);
            }

            if (visibleRect.width === 0 || visibleRect.height === 0) continue;

            // Check clipping (allow 10px tolerance for mobile)
            // We check the visible rect against the viewport
            if (visibleRect.left < -10 || visibleRect.top < -10 || visibleRect.right > viewWidth + 10 || visibleRect.bottom > viewHeight + 10) {
                throw new Error(`Element ${el.className} (${el.tagName}) is clipped by viewport: ${JSON.stringify(visibleRect)} vs viewport ${viewWidth}x${viewHeight}`);
            }

            // Check overlap
            for (const other of elements) {
                if (el === other) continue;
                const otherVisibleRect = getVisibleRect(other);
                
                const otherStyle = window.getComputedStyle(other);
                if (otherStyle.display === 'none' || otherStyle.visibility === 'hidden' || otherStyle.opacity === '0') continue;
                if (otherVisibleRect.width === 0 || otherVisibleRect.height === 0) continue;

                // Allow 5px tolerance for overlaps
                const overlap = !(visibleRect.right <= otherVisibleRect.left + 5 || 
                                  visibleRect.left >= otherVisibleRect.right - 5 || 
                                  visibleRect.bottom <= otherVisibleRect.top + 5 || 
                                  visibleRect.top >= otherVisibleRect.bottom - 5);
                
                if (overlap) {
                    // Check if one is a child of the other, which is fine
                    if (el.contains(other) || other.contains(el)) continue;
                    
                    // Also some overlays are expected (like the canvas on deduction board)
                    if (el.tagName === 'CANVAS' || other.tagName === 'CANVAS') continue;
                    
                    // Ignore overlaps with status-banner as it might overlay during end-game
                    if (el.classList.contains('status-banner') || other.classList.contains('status-banner') || 
                        el.closest('.status-banner') || other.closest('.status-banner')) continue;

                    // Allow some overlap between table/stands and their containers
                    const isTable = el.closest('.table') || other.closest('.table');
                    const isStand = el.closest('.stand-container') || other.closest('.stand-container');
                    const isArea = el.classList.contains('player-area') || el.classList.contains('opponents-area') || el.classList.contains('public-area') ||
                                   other.classList.contains('player-area') || other.classList.contains('opponents-area') || other.classList.contains('public-area');

                    if ((isTable || isStand) && isArea) continue;

                    throw new Error(`Element ${el.className} (${el.tagName}) overlaps with ${other.className} (${other.tagName})\nVisible Rect 1: ${JSON.stringify(visibleRect)}\nVisible Rect 2: ${JSON.stringify(otherVisibleRect)}`);
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

    constructor(private page: Page, private testInfo: TestInfo) {
        // Inject CSS to stabilize screenshots
        this.page.addInitScript(() => {
            const style = document.createElement('style');
            style.innerHTML = `
                *, *::before, *::after {
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    transition: none !important;
                    animation: none !important;
                }
            `;
            document.head.appendChild(style);
        });
    }

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
                .waitFor({ state: 'visible', timeout: 2000 })
                .then(() => true)
                .catch(() => false);
            if (statusVisible) {
                await expect(networkStatus.first()).toHaveAttribute('data-status', expectedStatus, { timeout: 2000 });
            }
        }

        await this.page.mouse.move(0, 0);
        await waitForAnimations(this.page);
        
        // 4. Check for clipping and overlap
        await checkNoClippingOrOverlap(this.page);

        // 5. Capture & Verify (Zero-Pixel Tolerance)
        await expect(this.page).toHaveScreenshot(filename.replace(/\.png$/, ''));

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
