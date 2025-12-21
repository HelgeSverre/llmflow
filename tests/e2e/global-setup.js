/**
 * Playwright Global Setup
 * 
 * Initializes test database with seed data before tests run.
 */

const fs = require('fs');
const path = require('path');

async function globalSetup() {
    const TEST_DATA_DIR = path.join(__dirname, '../../test-data');
    const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db');

    // Create test data directory
    if (!fs.existsSync(TEST_DATA_DIR)) {
        fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    // Delete existing DB to start fresh
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    // Set env vars for db.js
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.DB_PATH = TEST_DB_PATH;

    // Clear module cache to ensure db.js uses new env vars
    delete require.cache[require.resolve('../../db')];

    // Initialize database
    const db = require('../../db');

    // Seed with test data
    const { seedDatabase } = require('./seed-data');
    seedDatabase(db);

    console.log('✓ Global setup complete - DB path:', TEST_DB_PATH);
}

module.exports = globalSetup;
