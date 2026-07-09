import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on',
        contextOptions: { reducedMotion: 'reduce' },
        serviceWorkers: 'block',
        launchOptions: {
            args: [
                '--font-render-hinting=none',
                '--disable-font-subpixel-positioning',
                '--disable-lcd-text',
                '--disable-skia-runtime-opts',
                '--disable-system-font-check',
                '--disable-features=FontAccess,WebRtcHideLocalIpsWithMdns',
                '--force-device-scale-factor=1',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu', 
                '--use-gl=swiftshader',
                '--disable-smooth-scrolling',
                '--disable-partial-raster',
            ],
        },
        viewport: { width: 1280, height: 1000 },
        deviceScaleFactor: 1, 
        timezoneId: 'America/New_York',
        locale: 'en-CA',
        actionTimeout: 10000,
    },
    snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}.png',
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
            },
        },
    ],
    webServer: {
        command: 'bun run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
    timeout: 30000, 
    expect: {
        timeout: 10000,
        toHaveScreenshot: { 
            maxDiffPixelRatio: 0,
            animations: 'disabled',
            scale: 'css'
        }
    }
});
