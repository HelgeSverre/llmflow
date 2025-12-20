/**
 * Base provider class defining the interface for all LLM providers.
 * Each provider must implement these methods to handle request/response transformations.
 */
class BaseProvider {
    constructor() {
        this.name = 'base';
        this.displayName = 'Base Provider';
    }

    /**
     * Get the target configuration for the upstream request
     * @param {Object} req - Express request object
     * @returns {Object} { hostname, port, path, protocol }
     */
    getTarget(req) {
        throw new Error('getTarget() must be implemented by provider');
    }

    /**
     * Transform request headers for the upstream provider
     * @param {Object} headers - Original request headers
     * @param {Object} req - Express request object
     * @returns {Object} Transformed headers
     */
    transformRequestHeaders(headers, req) {
        return {
            'Content-Type': 'application/json',
            'Authorization': headers.authorization
        };
    }

    /**
     * Transform request body for the upstream provider
     * @param {Object} body - Original request body
     * @param {Object} req - Express request object
     * @returns {Object} Transformed body
     */
    transformRequestBody(body, req) {
        return body;
    }

    /**
     * Normalize response body to a common format for logging
     * @param {Object} body - Provider response body
     * @param {Object} req - Original request for context
     * @returns {Object} Normalized response with { data, usage, model }
     */
    normalizeResponse(body, req) {
        return {
            data: body,
            usage: body.usage || null,
            model: body.model || req.body?.model || 'unknown'
        };
    }

    /**
     * Parse a streaming chunk and extract content
     * @param {string} chunk - Raw chunk text
     * @returns {Object} { content, usage, done }
     */
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
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) content += delta;
                if (json.usage) usage = json.usage;
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done };
    }

    /**
     * Assemble a complete response from streaming chunks
     * @param {string} fullContent - Accumulated content
     * @param {Object} usage - Token usage info
     * @param {Object} req - Original request
     * @param {string} traceId - Trace ID
     * @returns {Object} Assembled response object
     */
    assembleStreamingResponse(fullContent, usage, req, traceId) {
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

    /**
     * Extract usage information from response
     * @param {Object} response - Provider response
     * @returns {Object} { prompt_tokens, completion_tokens, total_tokens }
     */
    extractUsage(response) {
        const usage = response.usage || {};
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
        };
    }

    /**
     * Check if streaming is requested
     * @param {Object} req - Express request object
     * @returns {boolean}
     */
    isStreamingRequest(req) {
        return req.body && req.body.stream === true;
    }

    /**
     * Get the HTTP/HTTPS module to use
     * @returns {Object} http or https module
     */
    getHttpModule() {
        return require('https');
    }
}

module.exports = BaseProvider;
