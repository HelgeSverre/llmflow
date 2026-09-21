import { test, expect } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const root = path.resolve(import.meta.dir, '../../..')
async function exercise(port: string | undefined) {
    const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-sdk-'))
    const env: Record<string, string | undefined> = {
        ...process.env,
        DATA_DIR: directory,
        DB_PATH: path.join(directory, 'test.db'),
        PROXY_PORT: '0',
        PRICING_URL: 'https://127.0.0.1:1/no',
        DASHBOARD_HOST: '127.0.0.1',
        DASHBOARD_PORT: port,
        LLMFLOW_URL: undefined,
        OTLP_EXPORT_ENDPOINT: '',
        OTLP_EXPORT_TRACES_ENDPOINT: '',
        OTLP_EXPORT_LOGS_ENDPOINT: '',
        OTLP_EXPORT_METRICS_ENDPOINT: '',
        OTLP_EXPORT_ENABLED: 'false',
    }
    const child = Bun.spawn(
        [
            process.execPath,
            '--no-env-file',
            '-e',
            `
        const {startDashboardServer}=await import('./apps/server/src/server.ts')
        const server=startDashboardServer()
        console.log(server.url.origin)
    `,
        ],
        { cwd: root, env, stdout: 'pipe', stderr: 'pipe' },
    )
    try {
        const reader = child.stdout.getReader()
        const initial = await reader.read()
        reader.releaseLock()
        const url = new TextDecoder().decode(initial.value).trim()
        expect(url.startsWith('http://127.0.0.1:')).toBe(true)
        const sdk = Bun.spawn(
            [
                process.execPath,
                '--no-env-file',
                '-e',
                `const {trace}=await import('./packages/sdk/index.js');await trace('sdk-endpoint-fixture',async()=>{})`,
            ],
            {
                cwd: root,
                env: { ...env, LLMFLOW_URL: port ? url : undefined },
                stderr: 'pipe',
                stdout: 'pipe',
            },
        )
        expect(await sdk.exited).toBe(0)
        expect(await new Response(sdk.stderr).text()).toBe('')
        const rows = await (await fetch(url + '/api/traces')).json()
        expect(rows.some((row: any) => row.span_name === 'sdk-endpoint-fixture')).toBe(true)
        const occupied = Bun.spawn(
            [
                process.execPath,
                '--no-env-file',
                '-e',
                `const {startDashboardServer}=await import('./apps/server/src/server.ts');startDashboardServer()`,
            ],
            {
                cwd: root,
                env: { ...env, DASHBOARD_PORT: new URL(url).port },
                stderr: 'pipe',
                stdout: 'pipe',
            },
        )
        expect(await occupied.exited).not.toBe(0)
        expect(await new Response(occupied.stderr).text()).toContain('in use')
    } finally {
        child.kill()
        await child.exited
        rmSync(directory, { recursive: true, force: true })
    }
}
test(
    'default SDK and default server agree; occupied port fails explicitly',
    () => exercise(undefined),
    15000,
)
test('explicit SDK endpoint and ephemeral server override agree', () => exercise('0'), 15000)
