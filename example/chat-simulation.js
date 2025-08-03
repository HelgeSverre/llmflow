#!/usr/bin/env node

// Simple chat simulation to test LLMFlow proxy
// This simulates a realistic conversation with context building over time

import OpenAI from 'openai';

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROXY_URL = process.env.LLMFLOW_URL || 'http://localhost:8080';
const MODEL = 'gpt-3.5-turbo';

if (!OPENAI_API_KEY) {
    console.error('❌ Please set OPENAI_API_KEY environment variable');
    console.error('   Example: OPENAI_API_KEY=sk-... node chat-simulation.js');
    process.exit(1);
}

// Initialize OpenAI client with proxy
const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: `${PROXY_URL}/v1`,
    httpAgent: undefined, // Let the library handle the agent
});

// Chat conversation flow
const conversationFlow = [
    { role: 'user', content: 'Hi there!' },
    { role: 'assistant', content: null }, // Will be filled by API
    { role: 'user', content: 'What\'s the capital of France?' },
    { role: 'assistant', content: null },
    { role: 'user', content: 'What are some famous landmarks there?' },
    { role: 'assistant', content: null },
    { role: 'user', content: 'How about Italy? What\'s its capital?' },
    { role: 'assistant', content: null },
    { role: 'user', content: 'Can you compare the two cities we just discussed? Which one is larger?' },
    { role: 'assistant', content: null },
];

// Simulate typing delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the chat simulation
async function runSimulation() {
    console.log('🤖 Starting LLMFlow Chat Simulation');
    console.log(`📡 Using proxy at: ${PROXY_URL}`);
    console.log(`🧠 Model: ${MODEL}\n`);

    const messages = [];
    let totalTokens = 0;
    let totalCost = 0;

    for (let i = 0; i < conversationFlow.length; i += 2) {
        const userMessage = conversationFlow[i];
        
        // Add user message
        messages.push(userMessage);
        console.log(`👤 User: ${userMessage.content}`);

        // Simulate thinking time
        await delay(500);

        try {
            // Call API with conversation history
            console.log('   ⏳ Thinking...');
            const startTime = Date.now();
            
            const response = await client.chat.completions.create({
                model: MODEL,
                messages: messages,
                temperature: 0.7,
                max_tokens: 150
            });
            
            const duration = Date.now() - startTime;
            const assistantMessage = response.choices[0].message;
            messages.push(assistantMessage);
            
            // Update conversation flow with actual response
            conversationFlow[i + 1] = assistantMessage;

            // Track usage
            const usage = response.usage || {};
            totalTokens += usage.total_tokens || 0;
            
            // Estimate cost (GPT-3.5-turbo pricing)
            const cost = ((usage.prompt_tokens || 0) * 0.0015 + (usage.completion_tokens || 0) * 0.002) / 1000;
            totalCost += cost;

            console.log(`🤖 Assistant: ${assistantMessage.content}`);
            console.log(`   📊 Tokens: ${usage.total_tokens || 0} | Cost: $${cost.toFixed(6)} | Time: ${duration}ms\n`);

            // Simulate reading time
            await delay(1000);

        } catch (error) {
            console.error(`❌ Error: ${error.message}\n`);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', error.response.data);
            }
            break;
        }
    }

    console.log('\n📈 Simulation Summary:');
    console.log(`   Total messages: ${messages.length}`);
    console.log(`   Total tokens: ${totalTokens}`);
    console.log(`   Total cost: $${totalCost.toFixed(6)}`);
    console.log(`\n✅ Simulation complete! Check the dashboard at http://localhost:3000`);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the simulation
runSimulation().catch(console.error);