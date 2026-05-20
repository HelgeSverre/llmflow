const BaseProvider = require('./base');

/**
 * Anthropic Claude provider.
 * Handles request/response transformation and different streaming format.
 */
class AnthropicProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'anthropic';
        this.displayName = 'Anthropic Claude';
        this.hostname = config.hostname || 'api.anthropic.com';
        this.apiVersion = config.apiVersion || '2023-06-01';
    }

    getTarget(req) {
        let path = req.path;
        
        // Map OpenAI-style paths to Anthropic paths
        if (path === '/v1/chat/completions') {
            path = '/v1/messages';
        }

        return {
            hostname: this.hostname,
            port: 443,
            path: path,
            protocol: 'https'
        };
    }

    transformRequestHeaders(headers, req) {
        // Anthropic uses x-api-key instead of Authorization Bearer
        let apiKey = headers.authorization;
        if (apiKey && apiKey.startsWith('Bearer ')) {
            apiKey = apiKey.slice(7);
        }
        
        // Also check for x-api-key header directly
        apiKey = headers['x-api-key'] || apiKey;

        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': this.apiVersion
        };
    }

    transformRequestBody(body, req) {
        if (!body || !body.messages) {
            return body;
        }

        const transformed = {
            model: body.model,
            max_tokens: body.max_tokens || 4096,  // Required field for Anthropic
            stream: body.stream || false
        };

        // Extract system message
        const systemMessages = body.messages.filter(m => m.role === 'system');
        const otherMessages = body.messages.filter(m => m.role !== 'system');

        if (systemMessages.length > 0) {
            transformed.system = systemMessages.map(m => m.content).join('\n');
        }

        // Transform messages (Anthropic expects role to be 'user' or 'assistant')
        transformed.messages = otherMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));

        // Copy over optional parameters
        if (body.temperature !== undefined) transformed.temperature = body.temperature;
        if (body.top_p !== undefined) transformed.top_p = body.top_p;
        if (body.stop) transformed.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];

        return transformed;
    }

    normalizeResponse(body, req) {
        if (!body || body.error) {
            return { data: body, usage: null, model: req.body?.model };
        }

        // Extract text content from content blocks
        let textContent = '';
        if (Array.isArray(body.content)) {
            textContent = body.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('');
        }

        // Map stop_reason to finish_reason
        const finishReasonMap = {
            'end_turn': 'stop',
            'stop_sequence': 'stop',
            'max_tokens': 'length'
        };

        const normalized = {
            id: body.id,
            object: 'chat.completion',
            model: body.model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: textContent
                },
                finish_reason: finishReasonMap[body.stop_reason] || body.stop_reason
            }],
            usage: {
                prompt_tokens: body.usage?.input_tokens || 0,
                completion_tokens: body.usage?.output_tokens || 0,
                total_tokens: (body.usage?.input_tokens || 0) + (body.usage?.output_tokens || 0)
            }
        };

        return {
            data: normalized,
            usage: normalized.usage,
            model: body.model
        };
    }

    parseStreamChunk(chunk) {
        const lines = chunk.split('\n');
        let content = '';
        let usage = null;
        let done = false;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Handle event: lines
            if (trimmed.startsWith('event:')) {
                const eventType = trimmed.slice(6).trim();
                if (eventType === 'message_stop') {
                    done = true;
                }
                continue;
            }

            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload) continue;

            try {
                const json = JSON.parse(payload);
                
                // Handle different event types
                if (json.type === 'content_block_delta') {
                    if (json.delta?.type === 'text_delta') {
                        content += json.delta.text || '';
                    }
                } else if (json.type === 'message_delta') {
                    if (json.usage) {
                        usage = {
                            prompt_tokens: 0, // Not provided in delta
                            completion_tokens: json.usage.output_tokens || 0,
                            total_tokens: json.usage.output_tokens || 0
                        };
                    }
                } else if (json.type === 'message_start' && json.message?.usage) {
                    // Initial usage from message_start
                    usage = {
                        prompt_tokens: json.message.usage.input_tokens || 0,
                        completion_tokens: 0,
                        total_tokens: json.message.usage.input_tokens || 0
                    };
                }
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done };
    }

    extractUsage(response) {
        const usage = response.usage || {};
        return {
            prompt_tokens: usage.input_tokens || usage.prompt_tokens || 0,
            completion_tokens: usage.output_tokens || usage.completion_tokens || 0,
            total_tokens: (usage.input_tokens || usage.prompt_tokens || 0) + 
                         (usage.output_tokens || usage.completion_tokens || 0)
        };
    }
}

module.exports = AnthropicProvider;
