import { afterAll, expect, test } from 'bun:test'
import path from 'node:path'
import { childEnv, startTestServer, type TestServer } from '../helpers/test-server'

// Real provider calls through the proxy. Each script skips the providers whose
// keys are missing; a script with no usable key is skipped here. TASK-78
// converts these into per-provider bun:test cases.
const has = (...keys: string[]) => keys.some((key) => !!process.env[key])
const suites = [
    {
        script: 'providers-e2e.js',
        enabled: has(
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'GEMINI_API_KEY',
            'GOOGLE_API_KEY',
            'GROQ_API_KEY',
            'MISTRAL_API_KEY',
            'TOGETHER_API_KEY',
            'COHERE_API_KEY',
            'AZURE_OPENAI_API_KEY',
        ),
    },
    {
        script: 'passthrough-e2e.js',
        enabled: has('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'),
    },
]

let server: TestServer | undefined
afterAll(() => server?.stop())

for (const { script, enabled } of suites) {
    test.skipIf(!enabled)(
        script,
        async () => {
            server ??= await startTestServer({ proxy: true, prefix: 'llmflow-live-' })
            const child = Bun.spawn([process.execPath, path.join(import.meta.dir, '..', script)], {
                env: childEnv({ LLMFLOW_URL: server.url, PROXY_URL: server.proxyUrl! }),
                stdout: 'inherit',
                stderr: 'inherit',
            })
            expect(await child.exited).toBe(0)
        },
        300000,
    )
}
