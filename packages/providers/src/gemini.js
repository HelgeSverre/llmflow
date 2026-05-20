const BaseProvider = require('./base');

/**
 * Google Gemini provider.
 * Handles the unique Gemini API format with request/response transformation.
 * 
 * Key differences from OpenAI:
 * - API key in query string OR Authorization header
 * - Different endpoint structure: /v1beta/models/{model}:generateContent
 * - Different request format (contents, systemInstruction, generationConfig)
 * - Different response format (candidates, usageMetadata)
 */
class GeminiProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'gemini';
        this.displayName = 'Google Gemini';
        this.hostname = config.hostname || 'generativelanguage.googleapis.com';
        this.apiVersion = config.apiVersion || 'v1beta';
    }

    getTarget(req) {
        // Extract model from request body for endpoint construction
        const model = req.body?.model || 'gemini-2.0-flash';
        const isStreaming = req.body?.stream === true;
        
        // Gemini uses different endpoints for streaming
        const action = isStreaming ? 'streamGenerateContent' : 'generateContent';
        
        // Build the path with model
        let path = `/${this.apiVersion}/models/${model}:${action}`;
        
        // Add API key as query param if provided in headers
        const apiKey = this.extractApiKey(req.headers);
        if (apiKey) {
            path += `?key=${apiKey}`;
        }

        return {
            hostname: this.hostname,
            port: 443,
            path: path,
            protocol: 'https'
        };
    }

    extractApiKey(headers) {
        if (!headers) return null;
        
        // Check for API key in various header formats
        let apiKey = headers['x-goog-api-key'];
        
        if (!apiKey && headers.authorization) {
            const auth = headers.authorization;
            if (auth.startsWith('Bearer ')) {
                apiKey = auth.slice(7);
            }
        }
        
        return apiKey;
    }

    transformRequestHeaders(headers, req) {
        // Gemini prefers API key in URL, but we can also use header
        const result = {
            'Content-Type': 'application/json'
        };
        
        // If using OAuth, include Authorization header
        if (headers.authorization && !this.extractApiKey(headers)) {
            result['Authorization'] = headers.authorization;
        }
        
        return result;
    }

    transformRequestBody(body, req) {
        if (!body) return body;
        
        // If already in Gemini format, pass through
        if (body.contents) {
            return body;
        }

        // Transform from OpenAI format to Gemini format
        const transformed = {};

        // Transform messages to contents
        if (body.messages) {
            const systemMessages = body.messages.filter(m => m.role === 'system');
            const otherMessages = body.messages.filter(m => m.role !== 'system');

            // System instruction
            if (systemMessages.length > 0) {
                transformed.systemInstruction = {
                    parts: [{ text: systemMessages.map(m => m.content).join('\n') }]
                };
            }

            // Contents (user/assistant messages)
            transformed.contents = otherMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            }));
        }

        // Generation config
        const generationConfig = {};
        if (body.max_tokens) generationConfig.maxOutputTokens = body.max_tokens;
        if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
        if (body.top_p !== undefined) generationConfig.topP = body.top_p;
        if (body.stop) {
            generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
        }
        
        if (Object.keys(generationConfig).length > 0) {
            transformed.generationConfig = generationConfig;
        }

        return transformed;
    }

    normalizeResponse(body, req) {
        if (!body || body.error) {
            return { data: body, usage: null, model: req.body?.model };
        }

        // Extract text content from candidates
        let textContent = '';
        let finishReason = 'stop';
        
        if (Array.isArray(body.candidates) && body.candidates.length > 0) {
            const candidate = body.candidates[0];
            if (candidate.content?.parts) {
                textContent = candidate.content.parts
                    .filter(p => p.text)
                    .map(p => p.text)
                    .join('');
            }
            
            // Map finish reason
            const reasonMap = {
                'STOP': 'stop',
                'MAX_TOKENS': 'length',
                'SAFETY': 'content_filter',
                'RECITATION': 'content_filter'
            };
            finishReason = reasonMap[candidate.finishReason] || candidate.finishReason?.toLowerCase() || 'stop';
        }

        // Extract usage
        const usage = body.usageMetadata || {};
        const normalizedUsage = {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens: usage.totalTokenCount || 0
        };

        // Build OpenAI-compatible response
        const normalized = {
            id: `gemini-${Date.now()}`,
            object: 'chat.completion',
            model: req.body?.model || 'gemini',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: textContent
                },
                finish_reason: finishReason
            }],
            usage: normalizedUsage
        };

        return {
            data: normalized,
            usage: normalizedUsage,
            model: req.body?.model || 'gemini'
        };
    }

    parseStreamChunk(chunk) {
        const lines = chunk.split('\n');
        let content = '';
        let usage = null;
        let done = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Gemini streaming returns JSON array items or objects
            try {
                let json;
                
                // Handle data: prefix if present
                if (trimmed.startsWith('data:')) {
                    const payload = trimmed.slice(5).trim();
                    if (payload === '[DONE]') {
                        done = true;
                        continue;
                    }
                    json = JSON.parse(payload);
                } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    // Direct JSON response (Gemini sometimes returns array)
                    json = JSON.parse(trimmed);
                    if (Array.isArray(json)) {
                        json = json[0];
                    }
                } else {
                    continue;
                }

                // Extract content from candidates
                if (json.candidates?.[0]?.content?.parts) {
                    for (const part of json.candidates[0].content.parts) {
                        if (part.text) content += part.text;
                    }
                }

                // Check for usage metadata
                if (json.usageMetadata) {
                    usage = {
                        prompt_tokens: json.usageMetadata.promptTokenCount || 0,
                        completion_tokens: json.usageMetadata.candidatesTokenCount || 0,
                        total_tokens: json.usageMetadata.totalTokenCount || 0
                    };
                }

                // Check finish reason
                if (json.candidates?.[0]?.finishReason) {
                    done = true;
                }
            } catch {
                // Ignore parse errors for partial chunks
            }
        }

        return { content, usage, done };
    }

    extractUsage(response) {
        // Handle both normalized and raw Gemini response
        if (response.usage) {
            return {
                prompt_tokens: response.usage.prompt_tokens || response.usage.promptTokenCount || 0,
                completion_tokens: response.usage.completion_tokens || response.usage.candidatesTokenCount || 0,
                total_tokens: response.usage.total_tokens || response.usage.totalTokenCount || 0
            };
        }
        
        if (response.usageMetadata) {
            return {
                prompt_tokens: response.usageMetadata.promptTokenCount || 0,
                completion_tokens: response.usageMetadata.candidatesTokenCount || 0,
                total_tokens: response.usageMetadata.totalTokenCount || 0
            };
        }

        return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }

    assembleStreamingResponse(fullContent, usage, req, traceId) {
        return {
            id: traceId,
            object: 'chat.completion',
            model: req.body?.model || 'gemini',
            choices: [{
                message: { role: 'assistant', content: fullContent },
                finish_reason: 'stop'
            }],
            usage: usage,
            _streaming: true
        };
    }
}

module.exports = GeminiProvider;
