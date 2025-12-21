#!/usr/bin/env node
/**
 * Test server starter
 * Sets environment variables, seeds the database, and then starts the main server
 */

const path = require('path');
const fs = require('fs');

// Set test environment
const TEST_DATA_DIR = path.join(__dirname, '../../test-data');
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db');

// Create test data directory
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

// Delete existing DB to start fresh
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('✓ Deleted existing test DB');
}

// Set env vars BEFORE requiring db.js
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.DB_PATH = TEST_DB_PATH;
process.env.DASHBOARD_PORT = '3000';
process.env.PROXY_PORT = '8080';
process.env.NODE_ENV = 'test';

console.log('Starting test server with:');
console.log('  DATA_DIR:', process.env.DATA_DIR);
console.log('  DB_PATH:', process.env.DB_PATH);

// Now require db.js - it will use the test env vars
const db = require('../../db');

// Seed the database
const { seedDatabase } = require('./seed-data');
seedDatabase(db);
console.log('✓ Database seeded with test data');

// Start the server
require('../../server');
