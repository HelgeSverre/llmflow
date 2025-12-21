#!/usr/bin/env node

/**
 * LLMFlow CLI
 * 
 * Usage:
 *   npx llmflow          # Start the server
 *   npx llmflow --help   # Show help
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
`);
    process.exit(0);
}

// Version
if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    console.log(`llmflow v${pkg.version}`);
    process.exit(0);
}

// Find server.js relative to this script
const serverPath = path.join(__dirname, '..', 'server.js');

if (!fs.existsSync(serverPath)) {
    console.error('Error: server.js not found at', serverPath);
    process.exit(1);
}

// Print startup banner
const pkg = require('../package.json');
console.log(`
╔═══════════════════════════════════════════════╗
║                   LLMFlow                     ║
║       Local LLM Observability v${pkg.version.padEnd(13)}║
╚═══════════════════════════════════════════════╝
`);

// Start the server
const server = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: process.env
});

server.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});

server.on('close', (code) => {
    process.exit(code || 0);
});

// Forward signals
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
