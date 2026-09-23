#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const args = process.argv.slice(2)

// env-help:start
const ENVIRONMENT_HELP =
    'Environment (see .env.example):\n  Servers\n    PROXY_PORT                    Proxy port (receives LLM API requests); 0 picks a free port (default 8080)\n    DASHBOARD_PORT                Dashboard, JSON API and OTLP receiver port; 0 picks a free port (default 1337)\n    PROXY_HOST                    Interface the proxy binds to (0.0.0.0 accepts remote clients) (default 127.0.0.1)\n    DASHBOARD_HOST                Interface the dashboard binds to (0.0.0.0 accepts remote clients) (default 127.0.0.1)\n    WS_ALLOWED_ORIGINS            Extra origins allowed to open the dashboard WebSocket (comma-separated)\n    PROXY_TIMEOUT_MS              Milliseconds before a proxied upstream request is aborted (default 300000)\n    VERBOSE                       Log debug detail (1=on); the --verbose flag does the same (default 0)\n  Storage\n    DATA_DIR                      Directory for the SQLite database (default: ~/.llmflow)\n    DB_PATH                       Full path to the SQLite file (default: $DATA_DIR/data.db)\n    MAX_TRACES                    Spans to keep; whole traces are pruned oldest first beyond this (default 10000)\n    MAX_LOGS                      Log records to keep; the oldest are pruned beyond this (default 100000)\n    MAX_METRICS                   Metric points to keep; the oldest are pruned beyond this (default 1000000)\n    PRICING_URL                   Model pricing JSON used for cost estimates (default https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json)\n  Provider API keys\n    OPENAI_API_KEY                OpenAI API key\n    ANTHROPIC_API_KEY             Anthropic API key\n    GEMINI_API_KEY                Google Gemini API key (wins over GOOGLE_API_KEY)\n    GOOGLE_API_KEY                Google Gemini API key, used when GEMINI_API_KEY is unset\n    COHERE_API_KEY                Cohere API key\n    AZURE_OPENAI_API_KEY          Azure OpenAI API key\n    GROQ_API_KEY                  Groq API key\n    MISTRAL_API_KEY               Mistral AI API key\n    TOGETHER_API_KEY              Together AI API key\n    PERPLEXITY_API_KEY            Perplexity API key\n    OPENROUTER_API_KEY            OpenRouter API key\n  Provider settings\n    OLLAMA_HOST                   Ollama host (default localhost)\n    OLLAMA_PORT                   Ollama port (default 11434)\n    AZURE_OPENAI_RESOURCE         Azure OpenAI resource name (an x-azure-resource header wins)\n    AZURE_OPENAI_API_VERSION      Azure OpenAI API version (default 2024-02-01)\n    AZURE_DEPLOYMENT_<MODEL>      Azure deployment for a model; <MODEL> is the model name uppercased with . and - as _\n    HELICONE_HOST                 Helicone gateway host (default oai.helicone.ai)\n    HELICONE_PORT                 Helicone gateway port (default 443)\n    HELICONE_API_KEY              Helicone key used when the request has no helicone-auth header\n  OTLP export\n    OTLP_EXPORT_ENABLED           Enable export (true); setting any endpoint enables it too (default false)\n    OTLP_EXPORT_TRACES_ENDPOINT   Full traces URL\n    OTLP_EXPORT_ENDPOINT          Alias for the traces URL; it does not enable logs or metrics\n    OTLP_EXPORT_LOGS_ENDPOINT     Full logs URL; logs are exported only when set\n    OTLP_EXPORT_METRICS_ENDPOINT  Full metrics URL; metrics are exported only when set\n    OTLP_EXPORT_PROTOCOL          http/json or http/protobuf (Phoenix accepts protobuf only) (default http/json)\n    OTLP_EXPORT_HEADERS           Headers sent with every export (comma-separated key=value)\n    OTLP_EXPORT_BATCH_SIZE        Records per export batch, per signal (default 100)\n    OTLP_EXPORT_FLUSH_INTERVAL    Milliseconds between flushes (default 5000)\n    LLMFLOW_OTLP_LEGACY_ATTRS     Also export the deprecated v1.36.0 GenAI attribute names (1=on) (default 0)\n  Development\n    LLMFLOW_URL                   Backend the dashboard dev server and demo target (default: the running dev backend)\n    LLMFLOW_DEV_STATE_DIR         Where dev servers record their URLs (default: a per-checkout temp directory)\n    VITE_PORT                     Dashboard dev server port (default 5173)\n    VITE_HOST                     Dashboard dev server bind interface (default 127.0.0.1)\n    LLMFLOW_REUSE_BUILD           Reuse an existing apps/server/dist instead of rebuilding (1=on; CI) (default 0)'
// env-help:end
if (args.includes('--help') || args.includes('-h')) {
    console.log(`LLMFlow - Local LLM observability
Usage: llmflow [--help | --version | --verbose]

Requires Bun: https://bun.sh/docs/installation

${ENVIRONMENT_HELP}

Dashboard: http://127.0.0.1:1337
OpenAI base URL: http://127.0.0.1:8080/v1`)
    process.exit(0)
}
if (args.includes('--version') || args.includes('-v')) {
    console.log(`llmflow v${version}`)
    process.exit(0)
}
if (args.some((arg) => arg !== '--verbose')) {
    console.error('Unknown argument. Run llmflow --help for supported options.')
    process.exit(2)
}
// A checkout always runs its current source (a leftover dist/ must not win); the npm
// package ships only bin/ and dist/, so installations run the bundle.
const bundled = path.join(root, 'dist/server.js')
const source = path.join(root, 'src/server.ts')
const serverFile = existsSync(source) ? source : bundled
if (!existsSync(serverFile)) {
    console.error('LLMFlow server artifact is missing. Reinstall llmflow.')
    process.exit(1)
}
const server = spawn('bun', ['--no-install', serverFile, ...args], {
    stdio: 'inherit',
})
server.on('error', (error) => {
    console.error(
        error.code === 'ENOENT'
            ? 'Bun is required to run LLMFlow. Install it from https://bun.sh/docs/installation, then rerun this command.'
            : `Failed to start LLMFlow: ${error.message}`,
    )
    process.exitCode = 1
})
server.on('close', (code, signal) => {
    if (!process.exitCode)
        process.exitCode =
            code === 0 ? 0 : signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1
})
process.on('SIGINT', () => server.kill('SIGINT'))
process.on('SIGTERM', () => server.kill('SIGTERM'))
