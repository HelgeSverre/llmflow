/**
 * RAG Pipeline + LLMFlow SDK Example
 * 
 * This example demonstrates proper span hierarchy using the LLMFlow SDK.
 * It simulates a RAG (Retrieval-Augmented Generation) pipeline with:
 * 
 * - Parent trace encompassing the entire workflow
 * - Child spans for each step (embedding, retrieval, generation)
 * - LLM calls linked to parent spans via trace headers
 * - Tool calls with their own spans
 * 
 * The resulting trace tree shows:
 * 
 *   rag-query (trace)
 *   ├── embed_query (embedding)
 *   ├── vector_search (retrieval)
 *   ├── rerank_results (chain)
 *   └── generate_answer (llm) ← linked via x-trace-id header
 * 
 * Prerequisites:
 *   1. Start LLMFlow: cd ../.. && npm start
 *   2. Set your OpenAI API key in .env at project root
 *   3. Run: node index.js (from this directory)
 */

import { trace, span, currentTraceHeaders, wrapOpenAI } from '../../sdk/index.js';
import OpenAI from 'openai';

const LLMFLOW_PROXY = process.env.LLMFLOW_PROXY || 'http://localhost:8080/v1';
const LLMFLOW_URL = process.env.LLMFLOW_URL || 'http://localhost:3000';

// Check for API key early
if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set');
    console.error('Add it to .env in project root');
    process.exit(1);
}

// Create OpenAI client routed through LLMFlow proxy
// Using wrapOpenAI to auto-inject trace headers
const openai = wrapOpenAI(new OpenAI({
    baseURL: LLMFLOW_PROXY,
    apiKey: process.env.OPENAI_API_KEY
}));

// Simulated knowledge base
const KNOWLEDGE_BASE = [
    { id: 1, text: "LLMFlow is an open-source LLM observability platform.", topic: "overview" },
    { id: 2, text: "LLMFlow captures traces via an OpenAI-compatible proxy on port 8080.", topic: "proxy" },
    { id: 3, text: "The LLMFlow dashboard runs on port 3000 and displays traces in real-time.", topic: "dashboard" },
    { id: 4, text: "LLMFlow supports OTLP/HTTP for OpenTelemetry integration.", topic: "otlp" },
    { id: 5, text: "The LLMFlow SDK enables hierarchical span tracking for complex pipelines.", topic: "sdk" },
    { id: 6, text: "Spans can have parent-child relationships to visualize execution flow.", topic: "spans" },
    { id: 7, text: "LLMFlow calculates token usage and estimated costs automatically.", topic: "costs" },
    { id: 8, text: "Multiple providers are supported: OpenAI, Anthropic, Gemini, Ollama, and more.", topic: "providers" }
];

/**
 * Simulate embedding generation
 * In production, this would call OpenAI's embedding API
 */
async function generateEmbedding(text) {
    // Simulate embedding generation with a delay
    await new Promise(resolve => setTimeout(resolve, 50));
    // Return a fake embedding (in production, use actual embeddings)
    return Array(1536).fill(0).map(() => Math.random());
}

/**
 * Simulate vector similarity search
 */
async function vectorSearch(embedding, topK = 3) {
    await new Promise(resolve => setTimeout(resolve, 100));
    // Simulate finding relevant documents
    const scores = KNOWLEDGE_BASE.map((doc, i) => ({
        ...doc,
        score: Math.random() * 0.5 + 0.5 // Random score between 0.5 and 1.0
    }));
    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Simulate document reranking
 */
async function rerankDocuments(docs, query) {
    await new Promise(resolve => setTimeout(resolve, 80));
    // In production, use a reranking model
    return docs.map(doc => ({
        ...doc,
        rerank_score: doc.score * (doc.text.toLowerCase().includes(query.toLowerCase().split(' ')[0]) ? 1.2 : 0.9)
    })).sort((a, b) => b.rerank_score - a.rerank_score);
}

/**
 * Execute a RAG query with full span instrumentation
 */
async function ragQuery(question) {
    return trace('rag-query', async () => {
        console.log(`\nProcessing: "${question}"\n`);

        // Step 1: Generate embedding for the query
        const embedding = await span({
            type: 'embedding',
            name: 'embed_query',
            input: { text: question, model: 'text-embedding-3-small' },
            attributes: { dimension: 1536 }
        }, async () => {
            console.log('  1. Generating query embedding...');
            const emb = await generateEmbedding(question);
            return { embedding: emb.slice(0, 5).map(v => v.toFixed(4)) + '...' }; // Truncate for display
        });

        // Step 2: Vector search
        const searchResults = await span({
            type: 'retrieval',
            name: 'vector_search',
            input: { top_k: 3 },
            attributes: { index: 'knowledge_base', metric: 'cosine' }
        }, async () => {
            console.log('  2. Searching vector database...');
            const results = await vectorSearch(embedding, 3);
            console.log(`     Found ${results.length} documents`);
            return results;
        });

        // Step 3: Rerank results
        const rerankedDocs = await span({
            type: 'chain',
            name: 'rerank_results',
            input: { doc_count: searchResults.length, query: question },
            attributes: { reranker: 'simple' }
        }, async () => {
            console.log('  3. Reranking documents...');
            const reranked = await rerankDocuments(searchResults, question);
            return reranked;
        });

        // Step 4: Generate answer using LLM
        // The LLM call goes through the proxy and is automatically linked
        // to this trace via the headers injected by wrapOpenAI
        const context = rerankedDocs.map(d => `- ${d.text}`).join('\n');
        
        console.log('  4. Generating answer with LLM...');
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful assistant. Answer questions based on the provided context.
                    
Context:
${context}

If the context doesn't contain relevant information, say so.`
                },
                { role: 'user', content: question }
            ],
            temperature: 0.7
        });

        const answer = response.choices[0].message.content;
        console.log(`  5. Answer generated (${response.usage?.total_tokens || 0} tokens)\n`);

        return {
            question,
            answer,
            sources: rerankedDocs.map(d => ({ id: d.id, score: d.rerank_score.toFixed(3) })),
            tokens: response.usage
        };
    }, {
        input: { question },
        tags: ['rag', 'demo'],
        serviceName: 'rag-pipeline'
    });
}

/**
 * Execute an agent-style query with tool use
 */
async function agentQuery(task) {
    return trace('agent-task', async () => {
        console.log(`\nAgent task: "${task}"\n`);

        let iteration = 0;
        const maxIterations = 3;
        let finalAnswer = null;

        while (iteration < maxIterations && !finalAnswer) {
            iteration++;

            // Agent thinking step
            const decision = await span({
                type: 'agent',
                name: `think_step_${iteration}`,
                input: { task, iteration },
                attributes: { max_iterations: maxIterations }
            }, async () => {
                console.log(`  Agent step ${iteration}: thinking...`);
                
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an agent that can search for information. 
Available tools: search_knowledge_base
If you need to search, respond with: TOOL:search_knowledge_base:query
Otherwise, provide a direct answer.`
                        },
                        { role: 'user', content: task }
                    ],
                    temperature: 0
                });

                return response.choices[0].message.content;
            });

            // Check if agent wants to use a tool
            if (decision.startsWith('TOOL:')) {
                const [, toolName, query] = decision.split(':');
                
                // Execute tool
                const toolResult = await span({
                    type: 'tool',
                    name: toolName,
                    input: { query: query.trim() },
                    attributes: { tool_type: 'search' }
                }, async () => {
                    console.log(`  Executing tool: ${toolName}`);
                    // Simulate tool execution
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const matches = KNOWLEDGE_BASE.filter(d => 
                        d.text.toLowerCase().includes(query.toLowerCase().split(' ')[0])
                    );
                    return matches.slice(0, 2).map(d => d.text);
                });

                // Generate answer from tool results
                finalAnswer = await span({
                    type: 'chain',
                    name: 'synthesize_answer',
                    input: { tool_results: toolResult }
                }, async () => {
                    console.log('  Synthesizing final answer...');
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'Summarize the search results concisely.' },
                            { role: 'user', content: `Results: ${toolResult.join('; ')}` }
                        ]
                    });
                    return response.choices[0].message.content;
                });
            } else {
                finalAnswer = decision;
            }
        }

        return { task, answer: finalAnswer, iterations: iteration };
    }, {
        input: { task },
        tags: ['agent', 'demo'],
        serviceName: 'agent-pipeline'
    });
}

async function main() {
    console.log('===========================================');
    console.log('  RAG Pipeline + LLMFlow SDK Example');
    console.log('===========================================');
    console.log(`\nSending spans to: ${LLMFLOW_URL}`);
    console.log(`LLM calls via proxy: ${LLMFLOW_PROXY}\n`);

    // Example 1: Simple RAG query
    console.log('--- Example 1: RAG Query ---');
    const ragResult = await ragQuery('How does LLMFlow capture traces?');
    console.log('Answer:', ragResult.answer);
    console.log('Sources:', ragResult.sources);
    console.log('');

    // Example 2: Another RAG query
    console.log('--- Example 2: RAG Query (costs) ---');
    const ragResult2 = await ragQuery('Does LLMFlow calculate costs?');
    console.log('Answer:', ragResult2.answer);
    console.log('');

    // Example 3: Agent-style query
    console.log('--- Example 3: Agent with Tool Use ---');
    const agentResult = await agentQuery('Find information about supported providers');
    console.log('Answer:', agentResult.answer);
    console.log('Iterations:', agentResult.iterations);
    console.log('');

    // Wait for spans to be sent
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('===========================================');
    console.log('  Examples Complete!');
    console.log('===========================================');
    console.log(`\nView traces at: ${LLMFLOW_URL}`);
    console.log('\nLook for traces with names:');
    console.log('  - "rag-query" (with child spans for embed, search, rerank, generate)');
    console.log('  - "agent-task" (with child spans for think, tool, synthesize)');
    console.log('\nClick on a trace to see the span tree hierarchy.');
}

main()
    .catch(console.error)
    .then(() => process.exit(0));
