const BaseProvider = require('./base');

/**
 * Azure OpenAI provider.
 * 
 * Key differences from OpenAI:
 * - Endpoint: https://{resource}.openai.azure.com/openai/deployments/{deployment}/{endpoint}?api-version={version}
 * - Uses api-key header instead of Authorization Bearer
 * - Model name in request is mapped to deployment name in URL
 * - api-version query parameter is required
 * - Request/response format is same as OpenAI
 */
class AzureOpenAIProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'azure';
        this.displayName = 'Azure OpenAI';
        
        // Azure configuration from environment or config
        this.resource = config.resource || process.env.AZURE_OPENAI_RESOURCE;
        this.apiVersion = config.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';
        
        // Optional: deployment name mapping (model -> deployment)
        this.deploymentMap = config.deploymentMap || {};
    }

    /**
     * Map OpenAI model name to Azure deployment name
     * Azure deployments often have dots removed (gpt-3.5-turbo -> gpt-35-turbo)
     */
    getDeploymentName(model) {
        // Check explicit mapping first
        if (this.deploymentMap[model]) {
            return this.deploymentMap[model];
        }
        
        // Check environment variable for specific model
        const envKey = `AZURE_DEPLOYMENT_${model.replace(/[.-]/g, '_').toUpperCase()}`;
        if (process.env[envKey]) {
            return process.env[envKey];
        }
        
        // Default: use model name as deployment (common pattern)
        // Also try removing dots (gpt-3.5-turbo -> gpt-35-turbo)
        return model.replace(/\./g, '');
    }

    /**
     * Extract Azure resource name from headers or use configured default
     */
    getResourceName(headers) {
        // Allow override via header
        const headerResource = headers?.['x-azure-resource'] || headers?.['x-llmflow-azure-resource'];
        if (headerResource) return headerResource;
        
        // Use configured resource
        if (this.resource) return this.resource;
        
        // Try environment variable
        return process.env.AZURE_OPENAI_RESOURCE || 'azure-openai';
    }

    getTarget(req) {
        const model = req.body?.model || 'gpt-4';
        const deployment = this.getDeploymentName(model);
        const resource = this.getResourceName(req.headers);
        
        // Map OpenAI path to Azure path
        let endpoint = req.path;
        if (endpoint.startsWith('/v1/')) {
            endpoint = endpoint.slice(3); // Remove /v1 prefix
        }

        // Build Azure path: /openai/deployments/{deployment}/{endpoint}?api-version={version}
        const path = `/openai/deployments/${deployment}${endpoint}?api-version=${this.apiVersion}`;

        return {
            hostname: `${resource}.openai.azure.com`,
            port: 443,
            path: path,
            protocol: 'https'
        };
    }

    transformRequestHeaders(headers, req) {
        // Azure uses api-key header instead of Authorization Bearer
        let apiKey = headers?.authorization;
        if (apiKey && apiKey.startsWith('Bearer ')) {
            apiKey = apiKey.slice(7);
        }
        
        // Also check for direct api-key header
        apiKey = headers?.['api-key'] || apiKey;

        return {
            'Content-Type': 'application/json',
            'api-key': apiKey
        };
    }

    // Request body format is same as OpenAI, no transformation needed
    transformRequestBody(body, req) {
        return body;
    }

    // Response format is same as OpenAI, use base implementation
    normalizeResponse(body, req) {
        if (!body || body.error) {
            return { data: body, usage: null, model: req.body?.model };
        }

        return {
            data: body,
            usage: body.usage || null,
            model: body.model || req.body?.model || 'unknown'
        };
    }

    // Streaming format is same as OpenAI
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

    extractUsage(response) {
        const usage = response.usage || {};
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
        };
    }
}

module.exports = AzureOpenAIProvider;
