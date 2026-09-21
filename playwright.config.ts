import { defineConfig, devices } from '@playwright/test'
import { createServer } from 'node:net'

async function reservePort(): Promise<string> {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No test port assigned')
    await new Promise<void>((resolve) => server.close(() => resolve()))
    return String(address.port)
}

const dashboardPort = (process.env.LLMFLOW_E2E_DASHBOARD_PORT ||= await reservePort())
const proxyPort = (process.env.LLMFLOW_E2E_PROXY_PORT ||= await reservePort())
const baseURL = `http://127.0.0.1:${dashboardPort}`

export default defineConfig({
    testDir: './e2e/playwright',
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'bun run build && bun e2e/playwright/start-test-server.js',
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 60000,
        env: {
            DASHBOARD_HOST: '127.0.0.1',
            PROXY_HOST: '127.0.0.1',
            DASHBOARD_PORT: String(dashboardPort),
            PROXY_PORT: String(proxyPort),
            OTLP_EXPORT_ENABLED: 'false',
            OTLP_EXPORT_ENDPOINT: '',
            OTLP_EXPORT_TRACES_ENDPOINT: '',
            OTLP_EXPORT_LOGS_ENDPOINT: '',
            OTLP_EXPORT_METRICS_ENDPOINT: '',
            OTEL_EXPORTER_OTLP_ENDPOINT: '',
        },
    },
})
