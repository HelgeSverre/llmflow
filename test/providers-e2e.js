#!/usr/bin/env node

/**
 * Provider End-to-End Tests
 * 
 * Tests real API calls through the proxy for each provider.
 * Requires API keys set in environment variables.
 * 
 * Usage:
 *   node test/run-tests.js providers-e2e.js
 *   
 * Or test specific providers:
 *   PROVIDERS=openai,anthropic node test/providers-e2e.js
 * 
 * Environment variables:
 *   OPENAI_API_KEY     - For OpenAI tests
 *   ANTHROPIC_API_KEY  - For Anthropic tests
 *   GROQ_API_KEY       - For Groq tests
 *   MISTRAL_API_KEY    - For Mistral tests
 *   TOGETHER_API_KEY   - For Together AI tests
 *   OLLAMA_HOST        - For Ollama tests (default: localhost)
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

async function testProvider(name, config) {
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
        
        // Log usage if available
        const usage = response.data?.usage;
        if (usage) {
            const tokens = usage.prompt_tokens || usage.input_tokens || 0;
            const completion = usage.completion_tokens || usage.output_tokens || 0;
            console.log(`${c.dim}  Tokens: ${tokens} prompt, ${completion} completion${c.reset}`);
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

async function verifyTraceLogged(provider) {
    try {
        const response = await request(`${DASHBOARD_URL}/api/traces?limit=1`, { method: 'GET' });
        if (response.data?.traces?.length > 0) {
            const trace = response.data.traces[0];
            if (trace.provider === provider) {
                console.log(`${c.dim}  Trace logged: ${trace.id}${c.reset}`);
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

async function main() {
    console.log(`\n${c.cyan}Provider E2E Tests${c.reset}`);
    console.log(`${c.dim}Proxy: ${PROXY_URL}${c.reset}\n`);
    
    const selectedProviders = process.env.PROVIDERS?.split(',').map(p => p.trim().toLowerCase());
    const shouldTest = (name) => !selectedProviders || selectedProviders.includes(name);
    
    // ============ OpenAI ============
    console.log(`\n${c.cyan}OpenAI${c.reset}\n`);
    
    if (!process.env.OPENAI_API_KEY) {
        skip('OpenAI Chat Completions', 'OPENAI_API_KEY not set');
        skip('OpenAI Responses API', 'OPENAI_API_KEY not set');
    } else if (!shouldTest('openai')) {
        skip('OpenAI', 'Not in PROVIDERS list');
    } else {
        await testProvider('OpenAI Chat Completions', {
            path: '/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('openai');
    }
    
    // ============ Anthropic ============
    console.log(`\n${c.cyan}Anthropic${c.reset}\n`);
    
    if (!process.env.ANTHROPIC_API_KEY) {
        skip('Anthropic Claude', 'ANTHROPIC_API_KEY not set');
    } else if (!shouldTest('anthropic')) {
        skip('Anthropic', 'Not in PROVIDERS list');
    } else {
        await testProvider('Anthropic Claude (via /anthropic path)', {
            path: '/anthropic/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'claude-3-haiku-20240307',
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }]
            },
            validate: (res) => {
                if (!res.data.content?.[0]?.text && !res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        // Test with OpenAI-style input (transformation test)
        await testProvider('Anthropic Claude (OpenAI format input)', {
            path: '/anthropic/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`
            },
            body: {
                model: 'claude-3-haiku-20240307',
                messages: [
                    { role: 'system', content: 'You are brief.' },
                    { role: 'user', content: 'Say hi' }
                ],
                max_tokens: 20
            },
            validate: (res) => {
                // Response should be normalized to OpenAI format
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Response not normalized to OpenAI format');
                }
            }
        });
        
        await verifyTraceLogged('anthropic');
    }
    
    // ============ Groq ============
    console.log(`\n${c.cyan}Groq${c.reset}\n`);
    
    if (!process.env.GROQ_API_KEY) {
        skip('Groq', 'GROQ_API_KEY not set');
    } else if (!shouldTest('groq')) {
        skip('Groq', 'Not in PROVIDERS list');
    } else {
        await testProvider('Groq (Llama)', {
            path: '/groq/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: {
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('groq');
    }
    
    // ============ Mistral ============
    console.log(`\n${c.cyan}Mistral${c.reset}\n`);
    
    if (!process.env.MISTRAL_API_KEY) {
        skip('Mistral', 'MISTRAL_API_KEY not set');
    } else if (!shouldTest('mistral')) {
        skip('Mistral', 'Not in PROVIDERS list');
    } else {
        await testProvider('Mistral AI', {
            path: '/mistral/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
            },
            body: {
                model: 'mistral-small-latest',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('mistral');
    }
    
    // ============ Together ============
    console.log(`\n${c.cyan}Together AI${c.reset}\n`);
    
    if (!process.env.TOGETHER_API_KEY) {
        skip('Together AI', 'TOGETHER_API_KEY not set');
    } else if (!shouldTest('together')) {
        skip('Together AI', 'Not in PROVIDERS list');
    } else {
        await testProvider('Together AI', {
            path: '/together/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
            },
            body: {
                model: 'meta-llama/Llama-3-8b-chat-hf',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('together');
    }
    
    // ============ Ollama ============
    console.log(`\n${c.cyan}Ollama (Local)${c.reset}\n`);
    
    if (!shouldTest('ollama')) {
        skip('Ollama', 'Not in PROVIDERS list');
    } else {
        // Check if Ollama is running
        try {
            const ollamaHost = process.env.OLLAMA_HOST || 'localhost';
            const ollamaPort = process.env.OLLAMA_PORT || 11434;
            
            await new Promise((resolve, reject) => {
                const req = http.get(`http://${ollamaHost}:${ollamaPort}/api/tags`, (res) => {
                    if (res.statusCode === 200) resolve();
                    else reject(new Error(`Ollama returned ${res.statusCode}`));
                });
                req.on('error', reject);
                req.setTimeout(2000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            
            await testProvider('Ollama (local)', {
                path: '/ollama/v1/chat/completions',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    model: 'llama3.2:1b',
                    messages: [{ role: 'user', content: 'Say hi' }],
                    max_tokens: 20
                },
                validate: (res) => {
                    if (!res.data.choices?.[0]?.message?.content) {
                        throw new Error('Missing response content');
                    }
                }
            });
            
            await verifyTraceLogged('ollama');
        } catch (err) {
            skip('Ollama', `Not running or not accessible: ${err.message}`);
        }
    }
    
    // ============ Cohere ============
    console.log(`\n${c.cyan}Cohere${c.reset}\n`);
    
    if (!process.env.COHERE_API_KEY) {
        skip('Cohere', 'COHERE_API_KEY not set');
    } else if (!shouldTest('cohere')) {
        skip('Cohere', 'Not in PROVIDERS list');
    } else {
        await testProvider('Cohere Command', {
            path: '/cohere/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.COHERE_API_KEY}`
            },
            body: {
                model: 'command',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('cohere');
    }
    
    // ============ Azure OpenAI ============
    console.log(`\n${c.cyan}Azure OpenAI${c.reset}\n`);
    
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_RESOURCE) {
        skip('Azure OpenAI', 'AZURE_OPENAI_API_KEY or AZURE_OPENAI_RESOURCE not set');
    } else if (!shouldTest('azure')) {
        skip('Azure OpenAI', 'Not in PROVIDERS list');
    } else {
        await testProvider('Azure OpenAI', {
            path: '/azure/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.AZURE_OPENAI_API_KEY}`,
                'x-azure-resource': process.env.AZURE_OPENAI_RESOURCE
            },
            body: {
                model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
                messages: [{ role: 'user', content: 'Say "test successful" in 3 words or less' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await verifyTraceLogged('azure');
    }
    
    // ============ Gemini ============
    console.log(`\n${c.cyan}Google Gemini${c.reset}\n`);
    
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        skip('Google Gemini', 'GEMINI_API_KEY not set');
    } else if (!shouldTest('gemini')) {
        skip('Google Gemini', 'Not in PROVIDERS list');
    } else {
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        
        await testProvider('Google Gemini (native format)', {
            path: '/gemini/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${geminiKey}`
            },
            body: {
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: 'Say "test ok" in 3 words' }] }]
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
        
        await testProvider('Google Gemini (OpenAI format)', {
            path: '/gemini/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${geminiKey}`
            },
            body: {
                model: 'gemini-2.0-flash',
                messages: [
                    { role: 'system', content: 'Be brief.' },
                    { role: 'user', content: 'Say hi' }
                ],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Response not normalized to OpenAI format');
                }
            }
        });
        
        await verifyTraceLogged('gemini');
    }
    
    // ============ Header Override Test ============
    console.log(`\n${c.cyan}Header Override${c.reset}\n`);
    
    if (process.env.GROQ_API_KEY && shouldTest('groq')) {
        await testProvider('X-LLMFlow-Provider header override', {
            path: '/v1/chat/completions',  // Default path, but override to Groq
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'X-LLMFlow-Provider': 'groq'
            },
            body: {
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'Say "header test ok"' }],
                max_tokens: 20
            },
            validate: (res) => {
                if (!res.data.choices?.[0]?.message?.content) {
                    throw new Error('Missing response content');
                }
            }
        });
    } else {
        skip('Header override test', 'Requires GROQ_API_KEY');
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
