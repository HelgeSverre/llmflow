#!/usr/bin/env node
// Seeds an isolated database and starts the Bun server for Playwright.
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'llmflow-playwright-'))
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'e2e.db')

process.env.DATA_DIR = TEST_DATA_DIR
process.env.DB_PATH = TEST_DB_PATH
process.env.NODE_ENV = 'test'

console.log('Starting test server with:')
console.log('  DATA_DIR:', process.env.DATA_DIR)
console.log('  DB_PATH:', process.env.DB_PATH)

const replayProvider = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
        const body = await request.json()
        if (body.model !== 'replay-fixture')
            return Response.json({ error: 'Unexpected fixture model' }, { status: 400 })
        return new Response(
            'data: {"model":"replay-fixture","choices":[{"delta":{"content":"Local replay result"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\ndata: [DONE]\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
        )
    },
})
process.env.OLLAMA_HOST = '127.0.0.1'
process.env.OLLAMA_PORT = String(replayProvider.port)

// Seed the database in this process, then close the handle so the
// server child process gets a clean SQLite connection.
const db = require('@llmflow/db')
const { seedDatabase } = require('./seed-data')
seedDatabase(db)
db.insertTrace({
    id: 'replay-browser-fixture',
    timestamp: Date.now() - 60000,
    provider: 'ollama',
    model: 'replay-fixture',
    span_name: 'Replay browser fixture',
    request_method: 'POST',
    request_path: '/ollama/v1/chat/completions',
    request_body: {
        model: 'replay-fixture',
        stream: true,
        messages: [{ role: 'user', content: 'replay browser request' }],
    },
})
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
server.on('exit', (code, signal) => {
    replayProvider.stop(true)
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    process.exit(code ?? (signal ? 1 : 0))
})
