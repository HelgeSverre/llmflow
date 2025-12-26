#!/usr/bin/env bun

/**
 * LLMFlow CLI
 * 
 * Usage:
 *   npx llmflow          # Start the server
 *   npx llmflow --help   # Show help
 * 
 * Requires Bun runtime: https://bun.sh
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

// Help text
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
LLMFlow - Local LLM Observability

Usage:
  llmflow [options]

Options:
  --help, -h      Show this help message
  --version, -v   Show version number

Environment Variables:
  PROXY_PORT      Proxy port (default: 8080)
  DASHBOARD_PORT  Dashboard port (default: 3000)
  DATA_DIR        Data directory (default: ~/.llmflow)
  MAX_TRACES      Max traces to retain (default: 10000)
  VERBOSE         Enable verbose logging (0 or 1)

Examples:
  npx llmflow                           # Start with defaults
  PROXY_PORT=9000 npx llmflow           # Custom proxy port
  VERBOSE=1 npx llmflow                 # Verbose logging

Dashboard: http://localhost:3000
Proxy:     http://localhost:8080

Point your OpenAI SDK at the proxy:
  client = OpenAI(base_url="http://localhost:8080/v1")

Requires Bun runtime: https://bun.sh
`);
    process.exit(0);
}

// Version
if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    console.log(`llmflow v${pkg.version}`);
    process.exit(0);
}

const serverFile = path.join(__dirname, '..', 'src', 'server.ts');

// Verify server file exists
if (!fs.existsSync(serverFile)) {
    console.error('Error: src/server.ts not found at', serverFile);
    process.exit(1);
}

// Print startup banner
const pkg = require('../package.json');
console.log(`\n\x1b[34mLLMFlow\x1b[0m - Local LLM observability v${pkg.version}\n`);

// Start the server with Bun
const server = spawn('bun', ['run', serverFile, ...args], {
    stdio: 'inherit',
    env: process.env
});

server.on('error', (err) => {
    if (err.code === 'ENOENT') {
        console.error('Error: Bun is required but not found.');
        console.error('Install Bun: curl -fsSL https://bun.sh/install | bash');
        process.exit(1);
    }
    console.error('Failed to start server:', err.message);
    process.exit(1);
});

server.on('close', (code) => {
    process.exit(code || 0);
});

// Forward signals
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
