const https = require('https');
const { v4: uuidv4 } = require('uuid');

/**
 * Base passthrough handler for forwarding requests without body transformation.
 * Used for AI CLI tools that send native API formats (Anthropic, Gemini).
 * 
 * Key differences from regular providers:
 * - Request body is NOT transformed - forwarded as-is
 * - Response body is NOT normalized - returned as-is to client
 * - Usage metrics ARE extracted for observability
 */
class PassthroughHandler {
    constructor(options = {}) {
        this.name = options.name || 'passthrough';
        this.displayName = options.displayName || 'Passthrough';
        this.targetHost = options.targetHost;
        this.targetPort = options.targetPort || 443;
        this.protocol = options.protocol || 'https';
        
        // Customizable hooks
        this.extractUsage = options.extractUsage || this.defaultExtractUsage;
        this.identifyModel = options.identifyModel || this.defaultIdentifyModel;
        this.headerTransform = options.headerTransform || this.defaultHeaderTransform;
        this.parseStreamChunk = options.parseStreamChunk || this.defaultParseStreamChunk;
    }

    /**
     * Get target configuration - passthrough preserves the original path
     */
    getTarget(req) {
        return {
            hostname: this.targetHost,
            port: this.targetPort,
            path: req.path,
            protocol: this.protocol
        };
    }

    /**
     * Transform headers for upstream - override in subclasses
     */
    defaultHeaderTransform(headers) {
        return {
            'Content-Type': headers['content-type'] || 'application/json',
            'Authorization': headers.authorization
        };
    }

    /**
     * Extract usage from response - override in subclasses
     */
    defaultExtractUsage(body) {
        const usage = body?.usage || {};
        return {
            prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
            completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 
                ((usage.prompt_tokens || usage.input_tokens || 0) + 
                 (usage.completion_tokens || usage.output_tokens || 0))
        };
    }

    /**
     * Identify model from request/response - override in subclasses
     */
    defaultIdentifyModel(reqBody, respBody) {
        return reqBody?.model || respBody?.model || 'unknown';
    }

    /**
     * Parse streaming chunk - override in subclasses
     */
    defaultParseStreamChunk(chunk) {
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
                if (json.usage) usage = this.extractUsage(json);
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done };
    }

    /**
     * Check if request is streaming
     */
    isStreamingRequest(req) {
        return req.body?.stream === true;
    }

    /**
     * Get HTTP module based on protocol
     */
    getHttpModule() {
        return this.protocol === 'https' ? https : require('http');
    }

    /**
     * Strip sensitive headers for logging
     */
    sanitizeHeaders(headers) {
        const safe = { ...headers };
        delete safe['x-api-key'];
        delete safe['authorization'];
        delete safe['x-goog-api-key'];
        delete safe['api-key'];
        return safe;
    }
}

/**
 * Anthropic passthrough handler for native Claude API format.
 * Used by Claude Code and other tools using Anthropic's /v1/messages endpoint.
 */
class AnthropicPassthrough extends PassthroughHandler {
    constructor() {
        super({
            name: 'anthropic-passthrough',
            displayName: 'Anthropic (Passthrough)',
            targetHost: 'api.anthropic.com',
            targetPort: 443,
            protocol: 'https'
        });
    }

    /**
     * Transform headers for Anthropic API
     */
    defaultHeaderTransform(headers) {
        // Extract API key from various sources
        let apiKey = headers['x-api-key'];
        if (!apiKey && headers.authorization) {
            apiKey = headers.authorization.replace(/^Bearer\s+/i, '');
        }

        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': headers['anthropic-version'] || '2023-06-01',
            // Pass through beta headers if present
            ...(headers['anthropic-beta'] && { 'anthropic-beta': headers['anthropic-beta'] })
        };
    }

    /**
     * Extract usage from Anthropic response format
     */
    defaultExtractUsage(body) {
        const usage = body?.usage || {};
        return {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            // Anthropic-specific: cache metrics
            cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: usage.cache_read_input_tokens || 0
        };
    }

    /**
     * Identify model from Anthropic request/response
     */
    defaultIdentifyModel(reqBody, respBody) {
        return respBody?.model || reqBody?.model || 'claude-unknown';
    }

    /**
     * Parse Anthropic streaming chunks
     */
    defaultParseStreamChunk(chunk) {
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
                            prompt_tokens: 0,
                            completion_tokens: json.usage.output_tokens || 0,
                            total_tokens: json.usage.output_tokens || 0
                        };
                    }
                } else if (json.type === 'message_start' && json.message?.usage) {
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
}

/**
 * Google Gemini passthrough handler for native Gemini API format.
 */
class GeminiPassthrough extends PassthroughHandler {
    constructor() {
        super({
            name: 'gemini-passthrough',
            displayName: 'Google Gemini (Passthrough)',
            targetHost: 'generativelanguage.googleapis.com',
            targetPort: 443,
            protocol: 'https'
        });
    }

    /**
     * Get target - Gemini uses API key in query string
     */
    getTarget(req) {
        let path = req.path;
        
        // Add API key to query string if provided
        const apiKey = this.extractApiKey(req.headers);
        if (apiKey) {
            const separator = path.includes('?') ? '&' : '?';
            path = `${path}${separator}key=${apiKey}`;
        }

        return {
            hostname: this.targetHost,
            port: this.targetPort,
            path: path,
            protocol: this.protocol
        };
    }

    /**
     * Extract API key from headers
     */
    extractApiKey(headers) {
        if (headers['x-goog-api-key']) {
            return headers['x-goog-api-key'];
        }
        if (headers.authorization) {
            return headers.authorization.replace(/^Bearer\s+/i, '');
        }
        return null;
    }

    /**
     * Transform headers for Gemini API
     */
    defaultHeaderTransform(headers) {
        return {
            'Content-Type': 'application/json'
            // API key is passed via query string, not header
        };
    }

    /**
     * Extract usage from Gemini response format
     */
    defaultExtractUsage(body) {
        const usage = body?.usageMetadata || {};
        return {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens: usage.totalTokenCount || 
                ((usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0))
        };
    }

    /**
     * Identify model from Gemini request/response
     */
    defaultIdentifyModel(reqBody, respBody) {
        // Model is often in response or can be extracted from path
        return respBody?.modelVersion || reqBody?.model || 'gemini-unknown';
    }

    /**
     * Parse Gemini streaming chunks
     */
    defaultParseStreamChunk(chunk) {
        let content = '';
        let usage = null;
        let done = false;

        try {
            // Gemini streams as JSON arrays or objects
            const json = JSON.parse(chunk);
            
            if (json.candidates?.[0]?.content?.parts) {
                content = json.candidates[0].content.parts
                    .filter(p => p.text)
                    .map(p => p.text)
                    .join('');
            }
            
            if (json.usageMetadata) {
                usage = this.defaultExtractUsage(json);
            }
            
            if (json.candidates?.[0]?.finishReason) {
                done = true;
            }
        } catch {
            // May be SSE format
            const lines = chunk.split('\n');
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
                    if (json.usageMetadata) {
                        usage = this.defaultExtractUsage(json);
                    }
                } catch {
                    // Ignore
                }
            }
        }

        return { content, usage, done };
    }
}

/**
 * OpenAI passthrough handler for native OpenAI API format.
 * Used by tools that already use OpenAI format but need passthrough for some reason.
 */
class OpenAIPassthrough extends PassthroughHandler {
    constructor() {
        super({
            name: 'openai-passthrough',
            displayName: 'OpenAI (Passthrough)',
            targetHost: 'api.openai.com',
            targetPort: 443,
            protocol: 'https'
        });
    }

    /**
     * Transform headers for OpenAI API
     */
    defaultHeaderTransform(headers) {
        return {
            'Content-Type': 'application/json',
            'Authorization': headers.authorization
        };
    }

    /**
     * Extract usage from OpenAI response format
     */
    defaultExtractUsage(body) {
        const usage = body?.usage || {};
        return {
            prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
            completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 
                ((usage.prompt_tokens || usage.input_tokens || 0) + 
                 (usage.completion_tokens || usage.output_tokens || 0))
        };
    }

    /**
     * Parse OpenAI streaming chunks
     */
    defaultParseStreamChunk(chunk) {
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
                if (json.usage) usage = this.defaultExtractUsage(json);
            } catch {
                // Ignore parse errors
            }
        }

        return { content, usage, done };
    }
}

module.exports = {
    PassthroughHandler,
    AnthropicPassthrough,
    GeminiPassthrough,
    OpenAIPassthrough
};
