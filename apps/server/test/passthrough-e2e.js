#!/usr/bin/env node

/**
 * Passthrough Mode End-to-End Tests
 * 
 * Tests real API calls through the passthrough proxy.
 * Requires API keys set in environment variables.
 * 
 * Usage:
 *   node test/run-tests.js passthrough-e2e.js
 *   
 * Environment variables:
 *   ANTHROPIC_API_KEY  - For Anthropic passthrough tests
 *   GEMINI_API_KEY     - For Gemini passthrough tests
 *   OPENAI_API_KEY     - For OpenAI passthrough tests
 */

const http = require('http');

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8080';
const DASHBOARD_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;
let skipped = 0;

function request(url, options, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: options.method || 'POST',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: JSON.parse(data)
                    });
                } catch {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testPassthrough(name, config) {
    const { path, headers, body, validate } = config;
    
    try {
        console.log(`${c.dim}  Testing ${name}...${c.reset}`);
        
        const response = await request(`${PROXY_URL}${path}`, { headers }, body);
        
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        }
        
        if (validate) {
            validate(response);
        }
        
        console.log(`${c.green}✓${c.reset} ${name}`);
        
        // Log usage if available (varies by provider format)
        const usage = response.data?.usage || response.data?.usageMetadata;
        if (usage) {
            const prompt = usage.prompt_tokens || usage.input_tokens || usage.promptTokenCount || 0;
            const completion = usage.completion_tokens || usage.output_tokens || usage.candidatesTokenCount || 0;
            console.log(`${c.dim}  Tokens: ${prompt} prompt, ${completion} completion${c.reset}`);
        }
        
        passed++;
        return true;
    } catch (err) {
        console.log(`${c.red}✗${c.reset} ${name}`);
        console.log(`  ${c.red}${err.message}${c.reset}`);
        failed++;
        return false;
    }
}

function skip(name, reason) {
    console.log(`${c.yellow}○${c.reset} ${name} - ${c.dim}${reason}${c.reset}`);
    skipped++;
}

async function verifyTraceLogged(providerName) {
    try {
        const response = await request(`${DASHBOARD_URL}/api/traces?limit=1`, { method: 'GET' });
        if (response.data?.traces?.length > 0) {
            const trace = response.data.traces[0];
            if (trace.provider === providerName) {
                console.log(`${c.dim}  Trace logged: ${trace.id.slice(0, 8)}...${c.reset}`);
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

async function main() {
    console.log(`\n${c.cyan}Passthrough Mode E2E Tests${c.reset}`);
    console.log(`${c.dim}Proxy: ${PROXY_URL}${c.reset}\n`);
    
    // ============ Anthropic Passthrough ============
    console.log(`\n${c.cyan}Anthropic Passthrough${c.reset}\n`);
    
    if (!process.env.ANTHROPIC_API_KEY) {
        skip('Anthropic Passthrough (native format)', 'ANTHROPIC_API_KEY not set');
        skip('Anthropic Passthrough (with system)', 'ANTHROPIC_API_KEY not set');
    } else {
        // Test native Anthropic format (as Claude Code would send)
        await testPassthrough('Anthropic Passthrough (native format)', {
            path: '/passthrough/anthropic/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 50,
                messages: [
                    { role: 'user', content: 'Say "passthrough test successful" in exactly 3 words' }
                ]
            },
            validate: (res) => {
                // Response should be native Anthropic format (NOT normalized to OpenAI)
                if (!res.data.content) {
                    throw new Error('Expected native Anthropic response with content array');
                }
                if (!Array.isArray(res.data.content)) {
                    throw new Error('content should be an array');
                }
                if (res.data.content[0].type !== 'text') {
                    throw new Error('Expected text content block');
                }
                // Check usage is in native format
                if (!res.data.usage?.input_tokens) {
                    throw new Error('Expected native usage.input_tokens');
                }
            }
        });
        
        await verifyTraceLogged('anthropic-passthrough');
        
        // Test with system prompt (native Anthropic format uses top-level system)
        await testPassthrough('Anthropic Passthrough (with system)', {
            path: '/passthrough/anthropic/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 50,
                system: 'You always respond with exactly 3 words.',
                messages: [
                    { role: 'user', content: 'Say hello' }
                ]
            },
            validate: (res) => {
                if (!res.data.content?.[0]?.text) {
                    throw new Error('Expected text content');
                }
            }
        });
        
        // Test using Authorization Bearer (should also work)
        await testPassthrough('Anthropic Passthrough (Bearer auth)', {
            path: '/passthrough/anthropic/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 20,
                messages: [
                    { role: 'user', content: 'Hi' }
                ]
            },
            validate: (res) => {
                if (!res.data.content) {
                    throw new Error('Expected Anthropic response');
                }
            }
        });
    }
    
    // ============ Compare Passthrough vs Transform ============
    console.log(`\n${c.cyan}Passthrough vs Transform Comparison${c.reset}\n`);
    
    if (process.env.ANTHROPIC_API_KEY) {
        // Same request via passthrough should return native format
        const passthroughResult = await request(`${PROXY_URL}/passthrough/anthropic/v1/messages`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        }, {
            model: 'claude-3-haiku-20240307',
            max_tokens: 20,
            messages: [{ role: 'user', content: 'Hi' }]
        });
        
        // Same request via transform should return OpenAI format
        const transformResult = await request(`${PROXY_URL}/anthropic/v1/messages`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        }, {
            model: 'claude-3-haiku-20240307',
            max_tokens: 20,
            messages: [{ role: 'user', content: 'Hi' }]
        });
        
        try {
            // Passthrough should have native content array
            if (!Array.isArray(passthroughResult.data.content)) {
                throw new Error('Passthrough should return native content array');
            }
            
            // Transform should have OpenAI choices array
            if (!Array.isArray(transformResult.data.choices)) {
                throw new Error('Transform should return OpenAI choices array');
            }
            
            console.log(`${c.green}✓${c.reset} Response format differs between passthrough and transform`);
            console.log(`${c.dim}  Passthrough: content[] (native)${c.reset}`);
            console.log(`${c.dim}  Transform: choices[] (OpenAI)${c.reset}`);
            passed++;
        } catch (err) {
            console.log(`${c.red}✗${c.reset} Response format comparison`);
            console.log(`  ${c.red}${err.message}${c.reset}`);
            failed++;
        }
    }
    
    // ============ Gemini Passthrough ============
    console.log(`\n${c.cyan}Gemini Passthrough${c.reset}\n`);
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!geminiKey) {
        skip('Gemini Passthrough (native format)', 'GEMINI_API_KEY not set');
    } else {
        await testPassthrough('Gemini Passthrough (native format)', {
            path: '/passthrough/gemini/v1beta/models/gemini-2.0-flash:generateContent',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
            },
            body: {
                contents: [{
                    role: 'user',
                    parts: [{ text: 'Say "passthrough test ok" in exactly 3 words' }]
                }],
                generationConfig: {
                    maxOutputTokens: 50
                }
            },
            validate: (res) => {
                // Response should be native Gemini format
                if (!res.data.candidates) {
                    throw new Error('Expected native Gemini response with candidates array');
                }
                if (!res.data.candidates[0]?.content?.parts) {
                    throw new Error('Expected content.parts in candidate');
                }
                // Check usage is in native format
                if (!res.data.usageMetadata?.promptTokenCount) {
                    throw new Error('Expected native usageMetadata.promptTokenCount');
                }
            }
        });
        
        await verifyTraceLogged('gemini-passthrough');
    }
    
    // ============ OpenAI Passthrough ============
    console.log(`\n${c.cyan}OpenAI Passthrough${c.reset}\n`);
    
    if (!process.env.OPENAI_API_KEY) {
        skip('OpenAI Passthrough', 'OPENAI_API_KEY not set');
    } else {
        await testPassthrough('OpenAI Passthrough (chat completions)', {
            path: '/passthrough/openai/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: {
                model: 'gpt-4o-mini',
                max_tokens: 20,
                messages: [
                    { role: 'user', content: 'Say "passthrough ok"' }
                ]
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Expected OpenAI chat completion response');
                }
            }
        });
        
        await verifyTraceLogged('openai-passthrough');
    }
    
    // ============ Provider List Includes Passthrough ============
    console.log(`\n${c.cyan}Provider Discovery${c.reset}\n`);
    
    try {
        const providersResponse = await request(`${PROXY_URL}/providers`, { method: 'GET' });
        
        if (!providersResponse.data.passthrough) {
            throw new Error('Missing passthrough providers in /providers response');
        }
        
        const passthroughNames = providersResponse.data.passthrough.map(p => p.name);
        
        if (!passthroughNames.includes('anthropic-passthrough')) {
            throw new Error('Missing anthropic-passthrough');
        }
        if (!passthroughNames.includes('gemini-passthrough')) {
            throw new Error('Missing gemini-passthrough');
        }
        if (!passthroughNames.includes('openai-passthrough')) {
            throw new Error('Missing openai-passthrough');
        }
        
        if (!providersResponse.data.usage.passthrough) {
            throw new Error('Missing passthrough usage instructions');
        }
        
        console.log(`${c.green}✓${c.reset} /providers lists passthrough providers`);
        console.log(`${c.dim}  ${passthroughNames.join(', ')}${c.reset}`);
        passed++;
    } catch (err) {
        console.log(`${c.red}✗${c.reset} Provider discovery`);
        console.log(`  ${c.red}${err.message}${c.reset}`);
        failed++;
    }
    
    // ============ Summary ============
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`${c.green}Passed: ${passed}${c.reset}`);
    if (failed > 0) {
        console.log(`${c.red}Failed: ${failed}${c.reset}`);
    }
    if (skipped > 0) {
        console.log(`${c.yellow}Skipped: ${skipped}${c.reset}`);
    }
    console.log('');
    
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
    process.exit(1);
});
