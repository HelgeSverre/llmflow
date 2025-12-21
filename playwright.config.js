// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    globalSetup: require.resolve('./tests/e2e/global-setup'),
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:3000',
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 10000,
    },
    webServer: {
        command: 'node server.js',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
        env: {
            DASHBOARD_PORT: '3000',
            PROXY_PORT: '8080',
            DATA_DIR: TEST_DATA_DIR,
            DB_PATH: TEST_DB_PATH,
        },
    },
});
