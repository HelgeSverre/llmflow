#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
    console.log(`LLMFlow - Local LLM observability
Usage: llmflow [--help | --version | --verbose]

Requires Bun: https://bun.sh/docs/installation

Environment:
  PROXY_PORT       Proxy port (default 8080)
  DASHBOARD_PORT   Dashboard port (default 1337)
  PROXY_HOST       Proxy bind address (default 127.0.0.1)
  DASHBOARD_HOST   Dashboard bind address (default 127.0.0.1)
  DATA_DIR         Data directory (default ~/.llmflow)
  DB_PATH          Explicit database file
  MAX_TRACES       Maximum retained spans (default 10000)
  PROXY_TIMEOUT_MS Upstream deadline (default 300000)
  VERBOSE          Verbose logging (1)

Dashboard: http://127.0.0.1:1337
OpenAI base URL: http://127.0.0.1:8080/v1`)
    process.exit(0)
}
if (args.includes('--version') || args.includes('-v')) {
    console.log(`llmflow v${version}`)
    process.exit(0)
}
if (args.some((arg) => arg !== '--verbose')) {
    console.error('Unknown argument. Run llmflow --help for supported options.')
    process.exit(2)
}
const bundled = path.join(root, 'dist/server.js')
const source = path.join(root, 'apps/server/src/server.ts')
const serverFile = existsSync(bundled) ? bundled : source
if (!existsSync(serverFile)) {
    console.error(
        'LLMFlow server artifact is missing. Reinstall llmflow or run bun run build in a checkout.',
    )
    process.exit(1)
}
const server = spawn('bun', ['--no-install', serverFile, ...args], {
    stdio: 'inherit',
    env: { ...process.env, LLMFLOW_ROOT: root },
})
server.on('error', (error) => {
    console.error(
        error.code === 'ENOENT'
            ? 'Bun is required to run LLMFlow. Install it from https://bun.sh/docs/installation, then rerun this command.'
            : `Failed to start LLMFlow: ${error.message}`,
    )
    process.exitCode = 1
})
server.on('close', (code, signal) => {
    if (!process.exitCode)
        process.exitCode =
            code === 0 ? 0 : signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1
})
process.on('SIGINT', () => server.kill('SIGINT'))
process.on('SIGTERM', () => server.kill('SIGTERM'))
