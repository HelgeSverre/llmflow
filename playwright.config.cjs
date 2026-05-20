// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db');

module.exports = defineConfig({
    testDir: './e2e/playwright',
    timeout: 60000,
    globalSetup: require.resolve('./e2e/playwright/global-setup'),
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:3001',
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 20000,
        navigationTimeout: 30000,
    },
    webServer: {
        command: 'node e2e/playwright/start-test-server.js',
        url: 'http://127.0.0.1:3001',
        reuseExistingServer: false,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
