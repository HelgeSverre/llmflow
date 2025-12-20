const BaseProvider = require('./base');

/**
 * Ollama provider - local LLM server with OpenAI-compatible API.
 * Uses HTTP instead of HTTPS.
 */
class OllamaProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.name = 'ollama';
        this.displayName = 'Ollama';
        this.hostname = config.hostname || process.env.OLLAMA_HOST || 'localhost';
        this.port = config.port || parseInt(process.env.OLLAMA_PORT) || 11434;
    }

    getTarget(req) {
        return {
            hostname: this.hostname,
            port: this.port,
            path: req.path,
            protocol: 'http'
        };
    }

    transformRequestHeaders(headers, req) {
        return {
            'Content-Type': 'application/json'
        };
    }

    getHttpModule() {
        return require('http');
    }
}

module.exports = OllamaProvider;
