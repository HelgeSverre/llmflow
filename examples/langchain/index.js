/**
 * LangChain.js + LLMFlow Integration Example
 * 
 * This example shows how to trace LangChain applications using OpenLLMetry
 * and send the traces to LLMFlow.
 * 
 * Prerequisites:
 *   1. Start LLMFlow: cd ../.. && npm start
 *   2. Set your OpenAI API key: export OPENAI_API_KEY=sk-...
 *   3. Install dependencies: npm install
 *   4. Run: npm start
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { LangChainInstrumentation } from '@traceloop/instrumentation-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Configure OpenTelemetry to export traces to LLMFlow
const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

const sdk = new NodeSDK({
    serviceName: 'langchain-example',
    traceExporter: new OTLPTraceExporter({
        url: `${LLMFLOW_URL}/v1/traces`
    }),
    instrumentations: [new LangChainInstrumentation()]
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

// Create a simple LangChain pipeline
async function runExample() {
    const model = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7
    });

    const prompt = ChatPromptTemplate.fromTemplate(
        'You are a helpful assistant. Answer this question concisely: {question}'
    );

    const outputParser = new StringOutputParser();

    // Create a chain
    const chain = prompt.pipe(model).pipe(outputParser);

    console.log('\n--- Running LangChain Example ---\n');

    // Example 1: Simple question
    console.log('Q: What is the capital of France?');
    const result1 = await chain.invoke({ question: 'What is the capital of France?' });
    console.log(`A: ${result1}\n`);

    // Example 2: Another question  
    console.log('Q: Explain async/await in JavaScript in one sentence');
    const result2 = await chain.invoke({ 
        question: 'Explain async/await in JavaScript in one sentence' 
    });
    console.log(`A: ${result2}\n`);

    // Example 3: Chained conversation
    const conversationPrompt = ChatPromptTemplate.fromTemplate(
        'Based on this context: "{context}", answer: {question}'
    );
    const conversationChain = conversationPrompt.pipe(model).pipe(outputParser);

    console.log('Q: Follow-up question with context');
    const result3 = await conversationChain.invoke({
        context: result1,
        question: 'What famous landmark is located there?'
    });
    console.log(`A: ${result3}\n`);

    console.log('--- Example Complete ---');
    console.log(`View traces at: ${LLMFLOW_URL}`);

    // Give time for traces to flush
    await new Promise(resolve => setTimeout(resolve, 2000));
}

runExample()
    .catch(console.error)
    .finally(() => process.exit(0));
