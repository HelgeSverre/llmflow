/**
 * Playwright Global Setup
 *
 * Note: Database seeding is now handled by start-test-server.js
 * to ensure the server and seeding happen in the correct order.
 */

async function globalSetup() {
    console.log('✓ Global setup complete (seeding handled by test server)')
}

module.exports = globalSetup
