const BaseProvider = require('./base');
const OpenAIProvider = require('./openai');
const OllamaProvider = require('./ollama');
const AnthropicProvider = require('./anthropic');
const GeminiProvider = require('./gemini');
const CohereProvider = require('./cohere');
const AzureOpenAIProvider = require('./azure');
const {
    OpenAICompatibleProvider,
    GroqProvider,
    MistralProvider,
    TogetherProvider,
    PerplexityProvider,
    OpenRouterProvider
} = require('./openai-compatible');

/**
 * Provider Registry
 * Maps path prefixes to provider instances
 */
class ProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.defaultProvider = null;
        
        // Register default providers
        this.registerDefaults();
    }

    registerDefaults() {
        // Default OpenAI provider (no prefix)
        this.defaultProvider = new OpenAIProvider();
        
        // Path-based providers
        this.register('ollama', new OllamaProvider());
        this.register('anthropic', new AnthropicProvider());
        this.register('gemini', new GeminiProvider());
        this.register('cohere', new CohereProvider());
        this.register('azure', new AzureOpenAIProvider());
        this.register('groq', GroqProvider);
        this.register('mistral', MistralProvider);
        this.register('together', TogetherProvider);
        this.register('perplexity', PerplexityProvider);
        this.register('openrouter', OpenRouterProvider);
    }

    /**
     * Register a provider with a path prefix
     * @param {string} prefix - URL path prefix (e.g., 'anthropic' for /anthropic/v1/...)
     * @param {BaseProvider} provider - Provider instance
     */
    register(prefix, provider) {
        this.providers.set(prefix.toLowerCase(), provider);
    }

    /**
     * Get a provider based on request path or header
     * @param {Object} req - Express request object
     * @returns {{ provider: BaseProvider, cleanPath: string }}
     */
    resolve(req) {
        // Check for X-LLMFlow-Provider header override
        const headerProvider = req.headers['x-llmflow-provider'];
        if (headerProvider && this.providers.has(headerProvider.toLowerCase())) {
            return {
                provider: this.providers.get(headerProvider.toLowerCase()),
                cleanPath: req.path
            };
        }

        // Check path prefix: /ollama/v1/... -> ollama provider
        const pathMatch = req.path.match(/^\/([^\/]+)(\/.*)?$/);
        if (pathMatch) {
            const prefix = pathMatch[1].toLowerCase();
            if (this.providers.has(prefix)) {
                const cleanPath = pathMatch[2] || '/';
                return {
                    provider: this.providers.get(prefix),
                    cleanPath: cleanPath
                };
            }
        }

        // Default to OpenAI
        return {
            provider: this.defaultProvider,
            cleanPath: req.path
        };
    }

    /**
     * List all registered providers
     * @returns {Array} List of { name, displayName, prefix }
     */
    list() {
        const result = [{
            name: this.defaultProvider.name,
            displayName: this.defaultProvider.displayName,
            prefix: '/v1/*',
            default: true
        }];

        for (const [prefix, provider] of this.providers) {
            result.push({
                name: provider.name,
                displayName: provider.displayName,
                prefix: `/${prefix}/v1/*`,
                default: false
            });
        }

        return result;
    }
}

// Singleton instance
const registry = new ProviderRegistry();

module.exports = {
    registry,
    ProviderRegistry,
    BaseProvider,
    OpenAIProvider,
    OllamaProvider,
    AnthropicProvider,
    GeminiProvider,
    CohereProvider,
    AzureOpenAIProvider,
    OpenAICompatibleProvider
};
