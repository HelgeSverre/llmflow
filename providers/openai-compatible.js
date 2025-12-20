const BaseProvider = require('./base');

/**
 * Generic OpenAI-compatible provider.
 * Used for Groq, Mistral, Together, etc.
 */
class OpenAICompatibleProvider extends BaseProvider {
    constructor(config) {
        super();
        this.name = config.name;
        this.displayName = config.displayName || config.name;
        this.hostname = config.hostname;
        this.port = config.port || 443;
        this.basePath = config.basePath || '';
        this.extraHeaders = config.extraHeaders || {};
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
            'Authorization': headers.authorization,
            ...this.extraHeaders
        };
    }
}

// Pre-configured providers
const GroqProvider = new OpenAICompatibleProvider({
    name: 'groq',
    displayName: 'Groq',
    hostname: 'api.groq.com',
    basePath: '/openai'
});

const MistralProvider = new OpenAICompatibleProvider({
    name: 'mistral',
    displayName: 'Mistral AI',
    hostname: 'api.mistral.ai'
});

const TogetherProvider = new OpenAICompatibleProvider({
    name: 'together',
    displayName: 'Together AI',
    hostname: 'api.together.xyz'
});

const PerplexityProvider = new OpenAICompatibleProvider({
    name: 'perplexity',
    displayName: 'Perplexity',
    hostname: 'api.perplexity.ai',
    basePath: ''  // No /v1 prefix for perplexity
});

const OpenRouterProvider = new OpenAICompatibleProvider({
    name: 'openrouter',
    displayName: 'OpenRouter',
    hostname: 'openrouter.ai',
    basePath: '/api'
});

module.exports = {
    OpenAICompatibleProvider,
    GroqProvider,
    MistralProvider,
    TogetherProvider,
    PerplexityProvider,
    OpenRouterProvider
};
