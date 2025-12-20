/**
 * Vercel AI SDK + LLMFlow Integration Example (OTLP)
 * 
 * This example shows how to use Vercel AI SDK with OpenTelemetry
 * telemetry, sending traces to LLMFlow via the OTLP endpoint.
 * 
 * Note: For simpler tracing, use the proxy approach (see ai-sdk-proxy example).
 * This example demonstrates OTLP telemetry for when you need OpenTelemetry
 * integration in addition to LLM call tracing.
 * 
 * Prerequisites:
 *   1. Start LLMFlow: cd ../.. && npm start
 *   2. Set your OpenAI API key in .env at project root
 *   3. Run: make examples (from project root)
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

const LLMFLOW_PROXY = process.env.LLMFLOW_PROXY || 'http://localhost:8080/v1';
const LLMFLOW_DASHBOARD = process.env.LLMFLOW_DASHBOARD || process.env.LLMFLOW_URL || 'http://localhost:3000';

// Check for API key early
if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set');
    console.error('Add it to .env in project root');
    process.exit(1);
}

console.log(`Vercel AI SDK routing through LLMFlow proxy at ${LLMFLOW_PROXY}`);

// Create OpenAI client that routes through LLMFlow proxy
const openai = createOpenAI({
    baseURL: LLMFLOW_PROXY,
    apiKey: process.env.OPENAI_API_KEY
});

async function runExample() {
    console.log('\n--- Running Vercel AI SDK Example ---\n');

    // Example 1: Simple text generation
    console.log('1. Generating text...');
    const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: 'Explain what observability means for LLM applications in one sentence.'
    });
    console.log(`Response: ${text}\n`);

    // Example 2: With system prompt
    console.log('2. Generating with system prompt...');
    const { text: text2 } = await generateText({
        model: openai('gpt-4o-mini'),
        system: 'You are a helpful coding assistant. Be concise.',
        prompt: 'What is the difference between let and const in JavaScript?'
    });
    console.log(`Response: ${text2}\n`);

    // Example 3: Streaming text generation
    console.log('3. Streaming response...');
    const stream = streamText({
        model: openai('gpt-4o-mini'),
        prompt: 'Count from 1 to 5, with a brief pause description between each number.'
    });

    process.stdout.write('Response: ');
    for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
    }
    console.log('\n');

    console.log('--- Example Complete ---');
    console.log(`View traces at: ${LLMFLOW_DASHBOARD}`);
}

runExample()
    .catch(console.error)
    .then(() => process.exit(0));
