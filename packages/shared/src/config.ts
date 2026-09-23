// Every environment variable LLMFlow reads, in one list. The typed getters below are the only
// place server and tooling code reads process.env; .env.example, the README table and
// `llmflow --help` are generated from SETTINGS (scripts/gen-env-docs.ts).
// Values are read on access, not at import, because tests and dev scripts set variables
// before importing the modules that use them.
import os from 'node:os'
import path from 'node:path'

export interface Setting {
    name: string
    group: Group
    description: string
    /** Shown as the default; omitted when the default is computed (see description). */
    default?: string
    /** Example value for .env.example when there is no literal default. */
    example?: string
    /** Written uncommented and empty in .env.example (API keys the user fills in). */
    fillIn?: boolean
    /** Extra comment lines for .env.example only. */
    notes?: string[]
}

export type Group =
    | 'Servers'
    | 'Storage'
    | 'Provider API keys'
    | 'Provider settings'
    | 'OTLP export'
    | 'Development'

export const GROUP_NOTES: Partial<Record<Group, string[]>> = {
    'Provider API keys': [
        'Proxied requests use the key the client sends. The server reads these only',
        'to replay a captured request from the dashboard.',
    ],
    'OTLP export': [
        'Forward stored traces, logs and metrics to another OTLP/HTTP backend',
        '(Jaeger, Grafana Tempo, Langfuse, Phoenix, Opik, ...).',
    ],
    Development: ['Used by bun run dev, bun run demo and the build scripts.'],
}

const key = (name: string, provider: string): Setting => ({
    name,
    group: 'Provider API keys',
    description: `${provider} API key`,
    fillIn: true,
})

export const SETTINGS: Setting[] = [
    {
        name: 'PROXY_PORT',
        group: 'Servers',
        default: '8080',
        description: 'Proxy port (receives LLM API requests); 0 picks a free port',
    },
    {
        name: 'DASHBOARD_PORT',
        group: 'Servers',
        default: '1337',
        description: 'Dashboard, JSON API and OTLP receiver port; 0 picks a free port',
    },
    {
        name: 'PROXY_HOST',
        group: 'Servers',
        default: '127.0.0.1',
        description: 'Interface the proxy binds to (0.0.0.0 accepts remote clients)',
    },
    {
        name: 'DASHBOARD_HOST',
        group: 'Servers',
        default: '127.0.0.1',
        description: 'Interface the dashboard binds to (0.0.0.0 accepts remote clients)',
    },
    {
        name: 'WS_ALLOWED_ORIGINS',
        group: 'Servers',
        example: 'https://llmflow.example.com',
        description: 'Extra origins allowed to open the dashboard WebSocket (comma-separated)',
    },
    {
        name: 'PROXY_TIMEOUT_MS',
        group: 'Servers',
        default: '300000',
        description: 'Milliseconds before a proxied upstream request is aborted',
    },
    {
        name: 'VERBOSE',
        group: 'Servers',
        default: '0',
        description: 'Log debug detail (1=on); the --verbose flag does the same',
    },

    {
        name: 'DATA_DIR',
        group: 'Storage',
        example: '/home/you/.llmflow',
        description: 'Directory for the SQLite database (default: ~/.llmflow)',
    },
    {
        name: 'DB_PATH',
        group: 'Storage',
        example: '/home/you/.llmflow/data.db',
        description: 'Full path to the SQLite file (default: $DATA_DIR/data.db)',
    },
    {
        name: 'MAX_TRACES',
        group: 'Storage',
        default: '10000',
        description: 'Spans to keep; whole traces are pruned oldest first beyond this',
    },
    {
        name: 'MAX_LOGS',
        group: 'Storage',
        default: '100000',
        description: 'Log records to keep; the oldest are pruned beyond this',
    },
    {
        name: 'MAX_METRICS',
        group: 'Storage',
        default: '1000000',
        description: 'Metric points to keep; the oldest are pruned beyond this',
    },
    {
        name: 'PRICING_URL',
        group: 'Storage',
        default:
            'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
        description: 'Model pricing JSON used for cost estimates',
    },

    key('OPENAI_API_KEY', 'OpenAI'),
    key('ANTHROPIC_API_KEY', 'Anthropic'),
    {
        ...key('GEMINI_API_KEY', 'Google Gemini'),
        description: 'Google Gemini API key (wins over GOOGLE_API_KEY)',
    },
    {
        ...key('GOOGLE_API_KEY', 'Google Gemini'),
        description: 'Google Gemini API key, used when GEMINI_API_KEY is unset',
    },
    key('COHERE_API_KEY', 'Cohere'),
    key('AZURE_OPENAI_API_KEY', 'Azure OpenAI'),
    key('GROQ_API_KEY', 'Groq'),
    key('MISTRAL_API_KEY', 'Mistral AI'),
    key('TOGETHER_API_KEY', 'Together AI'),
    key('PERPLEXITY_API_KEY', 'Perplexity'),
    key('OPENROUTER_API_KEY', 'OpenRouter'),

    {
        name: 'OLLAMA_HOST',
        group: 'Provider settings',
        default: 'localhost',
        description: 'Ollama host',
    },
    {
        name: 'OLLAMA_PORT',
        group: 'Provider settings',
        default: '11434',
        description: 'Ollama port',
    },
    {
        name: 'AZURE_OPENAI_RESOURCE',
        group: 'Provider settings',
        example: 'your-resource-name',
        description: 'Azure OpenAI resource name (an x-azure-resource header wins)',
    },
    {
        name: 'AZURE_OPENAI_API_VERSION',
        group: 'Provider settings',
        default: '2024-02-01',
        description: 'Azure OpenAI API version',
    },
    {
        name: 'AZURE_DEPLOYMENT_<MODEL>',
        group: 'Provider settings',
        example: 'gpt-4-deployment',
        description:
            'Azure deployment for a model; <MODEL> is the model name uppercased with . and - as _',
        notes: ['e.g. AZURE_DEPLOYMENT_GPT_35_TURBO=gpt-35-turbo-deployment'],
    },
    {
        name: 'HELICONE_HOST',
        group: 'Provider settings',
        default: 'oai.helicone.ai',
        description: 'Helicone gateway host',
    },
    {
        name: 'HELICONE_PORT',
        group: 'Provider settings',
        default: '443',
        description: 'Helicone gateway port',
    },
    {
        name: 'HELICONE_API_KEY',
        group: 'Provider settings',
        description: 'Helicone key used when the request has no helicone-auth header',
    },

    {
        name: 'OTLP_EXPORT_ENABLED',
        group: 'OTLP export',
        default: 'false',
        description: 'Enable export (true); setting any endpoint enables it too',
    },
    {
        name: 'OTLP_EXPORT_TRACES_ENDPOINT',
        group: 'OTLP export',
        example: 'http://localhost:4318/v1/traces',
        description: 'Full traces URL',
    },
    {
        name: 'OTLP_EXPORT_ENDPOINT',
        group: 'OTLP export',
        example: 'http://localhost:4318/v1/traces',
        description: 'Alias for the traces URL; it does not enable logs or metrics',
    },
    {
        name: 'OTLP_EXPORT_LOGS_ENDPOINT',
        group: 'OTLP export',
        example: 'http://localhost:4318/v1/logs',
        description: 'Full logs URL; logs are exported only when set',
    },
    {
        name: 'OTLP_EXPORT_METRICS_ENDPOINT',
        group: 'OTLP export',
        example: 'http://localhost:4318/v1/metrics',
        description: 'Full metrics URL; metrics are exported only when set',
    },
    {
        name: 'OTLP_EXPORT_PROTOCOL',
        group: 'OTLP export',
        default: 'http/json',
        description: 'http/json or http/protobuf (Phoenix accepts protobuf only)',
    },
    {
        name: 'OTLP_EXPORT_HEADERS',
        group: 'OTLP export',
        example: 'Authorization=Bearer xxx,X-Custom-Header=value',
        description: 'Headers sent with every export (comma-separated key=value)',
        notes: [
            'Langfuse: Authorization=Basic base64(pk:sk)',
            'Phoenix: space_id=xxx,api_key=xxx',
            'Opik: Authorization=your-api-key,projectName=your-project',
        ],
    },
    {
        name: 'OTLP_EXPORT_BATCH_SIZE',
        group: 'OTLP export',
        default: '100',
        description: 'Records per export batch, per signal',
    },
    {
        name: 'OTLP_EXPORT_FLUSH_INTERVAL',
        group: 'OTLP export',
        default: '5000',
        description: 'Milliseconds between flushes',
    },
    {
        name: 'LLMFLOW_OTLP_LEGACY_ATTRS',
        group: 'OTLP export',
        default: '0',
        description: 'Also export the deprecated v1.36.0 GenAI attribute names (1=on)',
    },

    {
        name: 'LLMFLOW_URL',
        group: 'Development',
        example: 'http://127.0.0.1:1337',
        description:
            'Backend the dashboard dev server and demo target (default: the running dev backend)',
    },
    {
        name: 'LLMFLOW_DEV_STATE_DIR',
        group: 'Development',
        example: '/tmp/llmflow-dev',
        description: 'Where dev servers record their URLs (default: a per-checkout temp directory)',
    },
    {
        name: 'VITE_PORT',
        group: 'Development',
        default: '5173',
        description: 'Dashboard dev server port',
    },
    {
        name: 'VITE_HOST',
        group: 'Development',
        default: '127.0.0.1',
        description: 'Dashboard dev server bind interface',
    },
    {
        name: 'LLMFLOW_REUSE_BUILD',
        group: 'Development',
        default: '0',
        description: 'Reuse an existing apps/server/dist instead of rebuilding (1=on; CI)',
    },
]

const declared = new Set(SETTINGS.map((setting) => setting.name))

/** The raw value of a declared variable; empty strings count as unset. */
export function readSetting(name: string): string | undefined {
    if (!declared.has(name)) throw new Error(`${name} is not declared in SETTINGS`)
    return process.env[name] || undefined
}

function port(name: string, fallback: number): number {
    const value = Number(readSetting(name) ?? fallback)
    if (!Number.isInteger(value) || value < 0 || value > 65535)
        throw new Error(`${name} must be a port from 0 to 65535`)
    return value
}

function int(name: string, fallback: number): number {
    return parseInt(readSetting(name) ?? '', 10) || fallback
}

const flag = (name: string) => readSetting(name) === '1'

// .env files are not shell-expanded, so a leading ~ is expanded here instead of creating ./~.
function expandHome(value: string | undefined) {
    if (!value) return undefined
    return value === '~' || /^~[\\/]/.test(value) ? path.join(os.homedir(), value.slice(1)) : value
}

export const config = {
    get proxyPort() {
        return port('PROXY_PORT', 8080)
    },
    get dashboardPort() {
        return port('DASHBOARD_PORT', 1337)
    },
    get proxyHost() {
        return readSetting('PROXY_HOST') || '127.0.0.1'
    },
    get dashboardHost() {
        return readSetting('DASHBOARD_HOST') || '127.0.0.1'
    },
    get wsAllowedOrigins() {
        return (readSetting('WS_ALLOWED_ORIGINS') || '')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
    },
    /** NaN when the value is not a number; the proxy reports that per request. */
    get proxyTimeoutMs() {
        return Number(readSetting('PROXY_TIMEOUT_MS') ?? 300000)
    },
    get verbose() {
        return flag('VERBOSE') || process.argv.includes('--verbose')
    },

    get dataDir() {
        return expandHome(readSetting('DATA_DIR')) || path.join(os.homedir(), '.llmflow')
    },
    get dbPath() {
        return expandHome(readSetting('DB_PATH')) || path.join(this.dataDir, 'data.db')
    },
    get maxTraces() {
        return Math.max(1, int('MAX_TRACES', 10000))
    },
    get maxLogs() {
        return int('MAX_LOGS', 100000)
    },
    get maxMetrics() {
        return int('MAX_METRICS', 1000000)
    },
    get pricingUrl() {
        return (
            readSetting('PRICING_URL') || SETTINGS.find((s) => s.name === 'PRICING_URL')!.default!
        )
    },

    get ollamaHost() {
        return readSetting('OLLAMA_HOST') || 'localhost'
    },
    get ollamaPort() {
        return int('OLLAMA_PORT', 11434)
    },
    get azureResource() {
        return readSetting('AZURE_OPENAI_RESOURCE')
    },
    get azureApiVersion() {
        return readSetting('AZURE_OPENAI_API_VERSION') || '2024-02-01'
    },
    /** AZURE_DEPLOYMENT_<MODEL>, e.g. gpt-3.5-turbo -> AZURE_DEPLOYMENT_GPT_3_5_TURBO. */
    azureDeployment(model: string) {
        return (
            process.env[`AZURE_DEPLOYMENT_${model.replace(/[.-]/g, '_').toUpperCase()}`] ||
            undefined
        )
    },
    get heliconeHost() {
        return readSetting('HELICONE_HOST') || 'oai.helicone.ai'
    },
    get heliconePort() {
        return readSetting('HELICONE_PORT') || '443'
    },
    get heliconeApiKey() {
        return readSetting('HELICONE_API_KEY')
    },

    get otlpExport() {
        const endpoints = {
            traces:
                readSetting('OTLP_EXPORT_TRACES_ENDPOINT') || readSetting('OTLP_EXPORT_ENDPOINT'),
            logs: readSetting('OTLP_EXPORT_LOGS_ENDPOINT'),
            metrics: readSetting('OTLP_EXPORT_METRICS_ENDPOINT'),
        }
        return {
            endpoints,
            enabled:
                readSetting('OTLP_EXPORT_ENABLED') === 'true' ||
                Object.values(endpoints).some(Boolean),
            protocol: readSetting('OTLP_EXPORT_PROTOCOL'),
            headers: readSetting('OTLP_EXPORT_HEADERS') || '',
            batchSize: int('OTLP_EXPORT_BATCH_SIZE', 100),
            flushIntervalMs: int('OTLP_EXPORT_FLUSH_INTERVAL', 5000),
            legacyAttributes: flag('LLMFLOW_OTLP_LEGACY_ATTRS'),
        }
    },

    get llmflowUrl() {
        return readSetting('LLMFLOW_URL')?.replace(/\/$/, '')
    },
    get devStateDir() {
        return readSetting('LLMFLOW_DEV_STATE_DIR')
    },
    get vitePort() {
        return port('VITE_PORT', 5173)
    },
    get viteHost() {
        return readSetting('VITE_HOST') || '127.0.0.1'
    },
    get reuseBuild() {
        return flag('LLMFLOW_REUSE_BUILD')
    },
}
