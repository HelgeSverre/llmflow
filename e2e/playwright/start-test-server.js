#!/usr/bin/env node
/**
 * Test server starter
 * Sets environment variables, seeds the database, and then starts the main server
 *
 * Usage:
 *   node tests/e2e/start-test-server.js          # Uses Node.js (original server.js)
 *   USE_BUN=1 bun tests/e2e/start-test-server.js # Uses Bun (src/server.ts)
 */

const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

// Set test environment
const TEST_DATA_DIR = path.join(__dirname, '../../test-data')
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db')

// Create test data directory
fs.mkdirSync(TEST_DATA_DIR, { recursive: true })

// Delete existing DB to start fresh
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
    console.log('✓ Deleted existing test DB')
}

// Set env vars BEFORE requiring db - the db module reads these at module init
process.env.DATA_DIR = TEST_DATA_DIR
process.env.DB_PATH = TEST_DB_PATH
process.env.DASHBOARD_PORT = '3001'
process.env.PROXY_PORT = '8081'
process.env.NODE_ENV = 'test'

console.log('Starting test server with:')
console.log('  DATA_DIR:', process.env.DATA_DIR)
console.log('  DB_PATH:', process.env.DB_PATH)

// Seed the database in this process, then close the handle so the
// server child process gets a clean SQLite connection.
const db = require('@llmflow/db')
const { seedDatabase } = require('./seed-data')
seedDatabase(db)
db.close()
console.log('✓ Database seeded with test data')

// Resolve the server entry through the workspace link so we don't
// hard-code apps/server/src/server.ts here.
const serverEntry = require.resolve('@llmflow/server')

const server = spawn('bun', [serverEntry], {
    stdio: 'inherit',
    env: process.env,
})

const forward = (sig) => () => server.kill(sig)
process.on('SIGTERM', forward('SIGTERM'))
process.on('SIGINT', forward('SIGINT'))
server.on('exit', (code) => process.exit(code ?? 0))
