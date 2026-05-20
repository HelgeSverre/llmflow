const BaseProvider = require('./base');

/**
 * Cohere v2 Chat API provider.
 * 
 * Key differences from OpenAI:
 * - Endpoint: POST /v2/chat
 * - Uses Bearer token authentication
 * - Response has nested usage structure (tokens.input_tokens, tokens.output_tokens)
 * - Assistant content is array of {type: "text", text: "..."} objects
 * - Different finish reasons: COMPLETE, STOP_SEQUENCE, MAX_TOKENS, TOOL_CALL
 * - Streaming uses granular event types (message-start, content-delta, message-end)
 */
class CohereProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'cohere';
        this.displayName = 'Cohere';
        this.hostname = config.hostname || 'api.cohere.com';
    }

    getTarget(req) {
        let path = req.path;
        
        // Map OpenAI-style paths to Cohere paths
        if (path === '/v1/chat/completions' || path === '/chat/completions') {
            path = '/v2/chat';
        }

        return {
            hostname: this.hostname,
            port: 443,
            path: path,
            protocol: 'https'
        };
    }

    transformRequestHeaders(headers, req) {
        return {
            'Content-Type': 'application/json',
            'Authorization': headers.authorization,
            'X-Client-Name': 'llmflow-proxy'
        };
    }

    transformRequestBody(body, req) {
        if (!body) return body;

        // Cohere v2 is very similar to OpenAI format
        // Main differences: max_tokens -> max_tokens, stop -> stop_sequences
        const transformed = {
            model: body.model,
            messages: body.messages,
            stream: body.stream || false
        };

        // Optional parameters
        if (body.max_tokens) transformed.max_tokens = body.max_tokens;
        if (body.temperature !== undefined) transformed.temperature = body.temperature;
        if (body.top_p !== undefined) transformed.p = body.top_p;  // Cohere uses 'p' not 'top_p'
        if (body.frequency_penalty !== undefined) transformed.frequency_penalty = body.frequency_penalty;
        if (body.presence_penalty !== undefined) transformed.presence_penalty = body.presence_penalty;
        if (body.stop) {
            transformed.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
        }

        return transformed;
    }

    normalizeResponse(body, req) {
        if (!body || body.error) {
            return { data: body, usage: null, model: req.body?.model };
        }

        // Extract text content from message.content array
        let textContent = '';
        if (body.message?.content) {
            if (Array.isArray(body.message.content)) {
                textContent = body.message.content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('');
            } else if (typeof body.message.content === 'string') {
                textContent = body.message.content;
            }
        }

        // Map Cohere finish reasons to OpenAI format
        const finishReasonMap = {
            'COMPLETE': 'stop',
            'STOP_SEQUENCE': 'stop',
            'MAX_TOKENS': 'length',
            'TOOL_CALL': 'tool_calls',
            'ERROR': 'content_filter',
            'TIMEOUT': 'content_filter'
        };

        // Extract usage - Cohere has nested structure
        const tokens = body.usage?.tokens || {};
        const billedUnits = body.usage?.billed_units || {};
        const normalizedUsage = {
            prompt_tokens: tokens.input_tokens || billedUnits.input_tokens || 0,
            completion_tokens: tokens.output_tokens || billedUnits.output_tokens || 0,
            total_tokens: (tokens.input_tokens || 0) + (tokens.output_tokens || 0)
        };

        // Build OpenAI-compatible response
        const normalized = {
            id: body.id || `cohere-${Date.now()}`,
            object: 'chat.completion',
            model: req.body?.model || 'command',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: textContent
                },
                finish_reason: finishReasonMap[body.finish_reason] || 'stop'
            }],
            usage: normalizedUsage
        };

        return {
            data: normalized,
            usage: normalizedUsage,
            model: req.body?.model || 'command'
        };
    }

    parseStreamChunk(chunk) {
        const lines = chunk.split('\n');
        let content = '';
        let usage = null;
        let done = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
                done = true;
                continue;
            }

            try {
                const json = JSON.parse(payload);

                // Handle different Cohere streaming event types
                switch (json.type) {
                    case 'content-delta':
                        // Content is in delta.message.content array
                        if (json.delta?.message?.content) {
                            for (const c of json.delta.message.content) {
                                if (c.type === 'text' && c.text) {
                                    content += c.text;
                                }
                            }
                        }
                        break;

                    case 'message-end':
                        done = true;
                        // Extract usage from message-end event
                        if (json.delta?.usage) {
                            const tokens = json.delta.usage.tokens || {};
                            const billedUnits = json.delta.usage.billed_units || {};
                            usage = {
                                prompt_tokens: tokens.input_tokens || billedUnits.input_tokens || 0,
                                completion_tokens: tokens.output_tokens || billedUnits.output_tokens || 0,
                                total_tokens: (tokens.input_tokens || 0) + (tokens.output_tokens || 0)
                            };
                        }
                        break;

                    case 'message-start':
                    case 'content-start':
                    case 'content-end':
                        // These are structural events, no content to extract
                        break;
                }
            } catch {
                // Ignore parse errors for partial chunks
            }
        }

        return { content, usage, done };
    }

    extractUsage(response) {
        // Handle both normalized and raw Cohere response
        if (response.usage) {
            // Already normalized
            if (response.usage.prompt_tokens !== undefined) {
                return response.usage;
            }
            // Raw Cohere format
            const tokens = response.usage.tokens || {};
            const billedUnits = response.usage.billed_units || {};
            return {
                prompt_tokens: tokens.input_tokens || billedUnits.input_tokens || 0,
                completion_tokens: tokens.output_tokens || billedUnits.output_tokens || 0,
                total_tokens: (tokens.input_tokens || 0) + (tokens.output_tokens || 0)
            };
        }

        return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    assembleStreamingResponse(fullContent, usage, req, traceId) {
        return {
            id: traceId,
            object: 'chat.completion',
            model: req.body?.model || 'command',
            choices: [{
                message: { role: 'assistant', content: fullContent },
                finish_reason: 'stop'
            }],
            usage: usage,
            _streaming: true
        };
    }
}

module.exports = CohereProvider;
