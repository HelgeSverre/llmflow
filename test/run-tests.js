#!/usr/bin/env node

/**
 * Test Runner
 * 
 * Starts the LLMFlow server, runs tests, then shuts down.
 * Usage: node test/run-tests.js [test-file]
 * 
 * Examples:
 *   node test/run-tests.js              # Run all tests
 *   node test/run-tests.js otlp-e2e.js  # Run specific test
 */

const { spawn, fork } = require('child_process');
const path = require('path');
const http = require('http');

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_FILE = path.join(ROOT_DIR, 'server.js');
const TEST_DIR = __dirname;

const HEALTH_URL = 'http://localhost:3000/api/health';
const MAX_WAIT_MS = 10000;
const POLL_INTERVAL_MS = 200;

let serverProcess = null;

async function waitForServer() {
    const start = Date.now();
    
    while (Date.now() - start < MAX_WAIT_MS) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(HEALTH_URL, (res) => {
                    if (res.statusCode === 200) {
                        resolve();
                    } else {
                        reject(new Error(`Status ${res.statusCode}`));
                    }
                });
                req.on('error', reject);
                req.setTimeout(1000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            return true;
        } catch {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
    }
    return false;
}

function startServer() {
    return new Promise((resolve, reject) => {
        console.log(`${c.dim}Starting server...${c.reset}`);
        
        serverProcess = fork(SERVER_FILE, [], {
            cwd: ROOT_DIR,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            env: { ...process.env, NODE_ENV: 'test' }
        });

        let started = false;

        serverProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Dashboard running')) {
                started = true;
                resolve();
            }
            // Only show server output in verbose mode
            if (process.env.VERBOSE === '1') {
                process.stdout.write(`${c.dim}[server] ${msg}${c.reset}`);
            }
        });

        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(`${c.red}[server] ${data}${c.reset}`);
        });

        serverProcess.on('error', (err) => {
            if (!started) reject(err);
        });

        serverProcess.on('exit', (code) => {
            if (!started && code !== 0) {
                reject(new Error(`Server exited with code ${code}`));
            }
        });

        // Timeout fallback
        setTimeout(() => {
            if (!started) {
                reject(new Error('Server startup timeout'));
            }
        }, MAX_WAIT_MS);
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (!serverProcess) {
            resolve();
            return;
        }

        console.log(`${c.dim}Stopping server...${c.reset}`);
        
        serverProcess.on('exit', () => {
            serverProcess = null;
            resolve();
        });

        serverProcess.kill('SIGTERM');

        // Force kill after 3 seconds
        setTimeout(() => {
            if (serverProcess) {
                serverProcess.kill('SIGKILL');
                serverProcess = null;
                resolve();
            }
        }, 3000);
    });
}

async function runTest(testFile) {
    return new Promise((resolve) => {
        const testPath = path.join(TEST_DIR, testFile);
        console.log(`\n${c.cyan}Running: ${testFile}${c.reset}\n`);

        const testProcess = spawn('node', [testPath], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            env: { ...process.env, LLMFLOW_URL: 'http://localhost:3000' }
        });

        testProcess.on('exit', (code) => {
            resolve(code || 0);
        });
    });
}

async function getTestFiles() {
    const fs = require('fs');
    const files = fs.readdirSync(TEST_DIR);
    return files.filter(f => 
        f.endsWith('.js') && 
        f !== 'run-tests.js' && 
        !f.startsWith('_')
    );
}

async function main() {
    const args = process.argv.slice(2);
    let testFiles = [];
    
    if (args.length > 0 && !args[0].startsWith('-')) {
        // Specific test file
        testFiles = [args[0]];
    } else {
        // All test files
        testFiles = await getTestFiles();
    }

    if (testFiles.length === 0) {
        console.log(`${c.yellow}No test files found${c.reset}`);
        process.exit(0);
    }

    console.log(`${c.cyan}LLMFlow Test Runner${c.reset}`);
    console.log(`${c.dim}Tests: ${testFiles.join(', ')}${c.reset}\n`);

    let exitCode = 0;

    try {
        // Start server
        await startServer();
        
        // Wait for server to be ready
        const ready = await waitForServer();
        if (!ready) {
            throw new Error('Server did not become ready');
        }
        console.log(`${c.green}Server ready${c.reset}`);

        // Run each test
        for (const testFile of testFiles) {
            const code = await runTest(testFile);
            if (code !== 0) {
                exitCode = code;
            }
        }

    } catch (err) {
        console.error(`${c.red}Error: ${err.message}${c.reset}`);
        exitCode = 1;
    } finally {
        await stopServer();
    }

    console.log('');
    if (exitCode === 0) {
        console.log(`${c.green}All tests passed${c.reset}`);
    } else {
        console.log(`${c.red}Some tests failed${c.reset}`);
    }

    process.exit(exitCode);
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    console.log(`\n${c.yellow}Interrupted${c.reset}`);
    await stopServer();
    process.exit(130);
});

main();
