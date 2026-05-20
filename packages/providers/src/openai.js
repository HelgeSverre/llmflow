const BaseProvider = require('./base');

/**
 * OpenAI provider - the reference implementation.
 * Supports both Chat Completions (/v1/chat/completions) and Responses (/v1/responses) APIs.
 * All OpenAI-compatible providers can extend this.
 */
class OpenAIProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'openai';
        this.displayName = 'OpenAI';
        this.hostname = config.hostname || 'api.openai.com';
        this.port = config.port || 443;
        this.basePath = config.basePath || '';
    }

    getTarget(req) {
        return {
            hostname: this.hostname,
            port: this.port,
            path: this.basePath + req.path,
            protocol: 'https'
        };
    }

    transformRequestHeaders(headers, req) {
        return {
            'Content-Type': 'application/json',
            'Authorization': headers.authorization
        };
    }

    /**
     * Check if this is a Responses API request
     */
    isResponsesAPI(req) {
        return req.path.includes('/responses');
    }

    /**
     * Normalize response - handles both Chat Completions and Responses API formats
     */
    normalizeResponse(body, req) {
        if (this.isResponsesAPI(req)) {
            return this.normalizeResponsesAPIResponse(body, req);
        }
        return super.normalizeResponse(body, req);
    }

    /**
     * Normalize Responses API response to common format for logging
     */
    normalizeResponsesAPIResponse(body, req) {
        if (!body || body.error) {
            return { data: body, usage: null, model: req.body?.model };
        }

        // Extract text content from output items
        let textContent = '';
        if (Array.isArray(body.output)) {
            for (const item of body.output) {
                if (item.type === 'message' && Array.isArray(item.content)) {
                    for (const content of item.content) {
                        if (content.type === 'output_text') {
                            textContent += content.text || '';
                        }
                    }
                }
            }
        }

        // Also check output_text helper if available
        if (!textContent && body.output_text) {
            textContent = body.output_text;
        }

        const usage = body.usage || {};
        const normalizedUsage = {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
        };

        return {
            data: body,
            usage: normalizedUsage,
            model: body.model || req.body?.model || 'unknown',
            // Store extracted text for easier access
            _extractedContent: textContent
        };
    }

    /**
     * Extract usage from response - handles both API formats
     */
    extractUsage(response) {
        const usage = response.usage || {};
        
        // Responses API uses input_tokens/output_tokens
        if (usage.input_tokens !== undefined) {
            return {
                prompt_tokens: usage.input_tokens || 0,
                completion_tokens: usage.output_tokens || 0,
                total_tokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0)
            };
        }
        
        // Chat Completions API uses prompt_tokens/completion_tokens
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
        };
    }

    /**
     * Parse streaming chunks - handles both API formats
     */
    parseStreamChunk(chunk) {
        const lines = chunk.split('\n');
        let content = '';
        let usage = null;
        let done = false;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Handle event: lines for Responses API
            if (trimmed.startsWith('event:')) {
                const eventType = trimmed.slice(6).trim();
                if (eventType === 'response.done' || eventType === 'done') {
                    done = true;
                }
                continue;
            }

            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
                done = true;
                continue;
            }

            try {
                const json = JSON.parse(payload);
                
                // Chat Completions format
                if (json.choices?.[0]?.delta?.content) {
                    content += json.choices[0].delta.content;
                }
                if (json.usage) {
                    usage = json.usage;
                }
                
                // Responses API format
                if (json.type === 'response.output_text.delta') {
                    content += json.delta || '';
                }
                if (json.type === 'response.done' && json.response?.usage) {
                    usage = {
                        prompt_tokens: json.response.usage.input_tokens || 0,
                        completion_tokens: json.response.usage.output_tokens || 0,
                        total_tokens: json.response.usage.total_tokens || 0
                    };
                    done = true;
                }
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done };
    }

    /**
     * Assemble streaming response - handles both API formats
     */
    assembleStreamingResponse(fullContent, usage, req, traceId) {
        const isResponses = this.isResponsesAPI(req);
        
        if (isResponses) {
            return {
                id: traceId,
                object: 'response',
                model: req.body?.model,
                output: [{
                    type: 'message',
                    role: 'assistant',
                    content: [{
                        type: 'output_text',
                        text: fullContent
                    }]
                }],
                output_text: fullContent,
                usage: usage,
                _streaming: true
            };
        }

        // Chat Completions format
        return {
            id: traceId,
            object: 'chat.completion',
            model: req.body?.model,
            choices: [{
                message: { role: 'assistant', content: fullContent },
                finish_reason: 'stop'
            }],
            usage: usage,
            _streaming: true
        };
    }
}

module.exports = OpenAIProvider;
