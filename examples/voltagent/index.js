/**
 * VoltAgent + LLMFlow Integration Example
 * 
 * This example shows how to trace VoltAgent applications
 * and send traces to LLMFlow via OpenTelemetry.
 * 
 * VoltAgent has built-in observability support. You can configure
 * a custom telemetry exporter to send traces to LLMFlow.
 * 
 * Prerequisites:
 *   1. Start LLMFlow: cd ../.. && npm start
 *   2. Set your OpenAI API key: export OPENAI_API_KEY=sk-...
 *   3. Install dependencies: npm install
 *   4. Run: npm start
 */

import { VoltAgent, Agent } from '@voltagent/core';
import { VercelAIProvider } from '@voltagent/vercel-ai';
import { openai } from '@ai-sdk/openai';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Configure OpenTelemetry to export traces to LLMFlow
const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

const sdk = new NodeSDK({
    serviceName: 'voltagent-example',
    traceExporter: new OTLPTraceExporter({
        url: `${LLMFLOW_URL}/v1/traces`
    })
});

sdk.start();
console.log('OpenTelemetry initialized, exporting traces to LLMFlow');

// Create a simple VoltAgent
const agent = new Agent({
    name: 'llmflow-demo-agent',
    description: 'A helpful assistant that demonstrates LLMFlow tracing',
    llm: new VercelAIProvider(),
    model: openai('gpt-4o-mini'),
    tools: [
        {
            name: 'get_weather',
            description: 'Get the current weather for a location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'The city name'
                    }
                },
                required: ['location']
            },
            execute: async ({ location }) => {
                // Simulated weather data
                const weather = ['sunny', 'cloudy', 'rainy', 'snowy'];
                const temp = Math.floor(Math.random() * 30) + 5;
                return {
                    location,
                    condition: weather[Math.floor(Math.random() * weather.length)],
                    temperature: `${temp}°C`
                };
            }
        }
    ]
});

// Initialize VoltAgent
new VoltAgent({
    agents: { agent }
});

async function runExample() {
    console.log('\n--- Running VoltAgent Example ---\n');

    // Example 1: Simple conversation
    console.log('1. Asking a simple question...');
    const response1 = await agent.chat('What is the meaning of life?');
    console.log(`Response: ${response1.content}\n`);

    // Example 2: Using a tool
    console.log('2. Using the weather tool...');
    const response2 = await agent.chat('What is the weather like in Tokyo?');
    console.log(`Response: ${response2.content}\n`);

    // Example 3: Multi-turn conversation
    console.log('3. Multi-turn conversation...');
    const response3 = await agent.chat('Tell me a joke about programming');
    console.log(`Response: ${response3.content}\n`);

    console.log('--- Example Complete ---');
    console.log(`View traces at: ${LLMFLOW_URL}`);

    // Give time for traces to flush
    await new Promise(resolve => setTimeout(resolve, 2000));
}

runExample()
    .catch(console.error)
    .finally(() => process.exit(0));
