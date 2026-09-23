import { test, expect } from 'bun:test'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { childEnv, isolatedEnv, tempDirectory } from './helpers/test-server'
const root = path.resolve(import.meta.dir, '../../..')
async function exercise(port: string | undefined) {
    const directory = tempDirectory('llmflow-sdk-')
    const env = childEnv(isolatedEnv(directory, { DASHBOARD_PORT: port }))
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
                `const {trace}=await import('./packages/sdk/src/index.ts');await trace('sdk-endpoint-fixture',async()=>{})`,
            ],
            {
                cwd: root,
                env: port ? { ...env, LLMFLOW_URL: url } : env,
                stderr: 'pipe',
                stdout: 'pipe',
            },
        )
        expect(await sdk.exited).toBe(0)
        expect(await new Response(sdk.stderr).text()).toBe('')
        const rows = (await (await fetch(url + '/api/spans')).json()) as { span_name: string }[]
        expect(rows.some((row) => row.span_name === 'sdk-endpoint-fixture')).toBe(true)
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
