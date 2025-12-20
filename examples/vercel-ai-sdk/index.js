/**
 * Vercel AI SDK + LLMFlow Integration Example
 * 
 * This example shows how to trace Vercel AI SDK applications
 * and send traces to LLMFlow via OpenTelemetry.
 * 
 * Prerequisites:
 *   1. Start LLMFlow: cd ../.. && npm start
 *   2. Set your OpenAI API key: export OPENAI_API_KEY=sk-...
 *   3. Install dependencies: npm install
 *   4. Run: npm start
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Configure OpenTelemetry to export traces to LLMFlow
const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

const sdk = new NodeSDK({
    serviceName: 'vercel-ai-example',
    traceExporter: new OTLPTraceExporter({
        url: `${LLMFLOW_URL}/v1/traces`
    })
});

sdk.start();
console.log('OpenTelemetry initialized, exporting traces to LLMFlow');

// Graceful shutdown
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('SDK shut down'))
        .catch((err) => console.error('Error shutting down SDK', err))
        .finally(() => process.exit(0));
});

async function runExample() {
    console.log('\n--- Running Vercel AI SDK Example ---\n');

    // Example 1: Simple text generation with telemetry
    console.log('1. Generating text...');
    const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: 'Explain what observability means for LLM applications in one sentence.',
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'explain-observability',
            metadata: {
                example: 'vercel-ai-sdk',
                version: '1.0'
            }
        }
    });
    console.log(`Response: ${text}\n`);

    // Example 2: Structured generation with system prompt
    console.log('2. Generating with system prompt...');
    const { text: text2 } = await generateText({
        model: openai('gpt-4o-mini'),
        system: 'You are a helpful coding assistant. Be concise.',
        prompt: 'What is the difference between let and const in JavaScript?',
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'coding-assistant'
        }
    });
    console.log(`Response: ${text2}\n`);

    // Example 3: Streaming text generation
    console.log('3. Streaming response...');
    const stream = streamText({
        model: openai('gpt-4o-mini'),
        prompt: 'Count from 1 to 5, with a brief pause description between each number.',
        experimental_telemetry: {
            isEnabled: true,
            functionId: 'streaming-count'
        }
    });

    process.stdout.write('Response: ');
    for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
    }
    console.log('\n');

    console.log('--- Example Complete ---');
    console.log(`View traces at: ${LLMFLOW_URL}`);

    // Give time for traces to flush
    await new Promise(resolve => setTimeout(resolve, 2000));
}

runExample()
    .catch(console.error)
    .finally(() => process.exit(0));
