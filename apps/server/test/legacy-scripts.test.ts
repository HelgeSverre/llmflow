import { afterAll, beforeAll, expect, test } from 'bun:test'
import path from 'node:path'
import { childEnv, startTestServer, type TestServer } from './helpers/test-server'

// Transitional: these scripts still use their own test()/assert() counters and
// process.exit, so they run as child processes against one in-process server.
// TASK-77 converts them to bun:test and removes them from this list.
const scripts = [
    'otlp-export.test.js',
    'otlp-session-extraction.test.js',
    'passthrough.js',
    'providers.js',
]

let server: TestServer
beforeAll(async () => {
    server = await startTestServer({ prefix: 'llmflow-legacy-' })
})
afterAll(() => server.stop())

for (const script of scripts) {
    test(
        script,
        async () => {
            const child = Bun.spawn([process.execPath, path.join(import.meta.dir, script)], {
                env: childEnv({ LLMFLOW_URL: server.url }),
                stdout: 'pipe',
                stderr: 'pipe',
            })
            const [output, errors, code] = await Promise.all([
                new Response(child.stdout).text(),
                new Response(child.stderr).text(),
                child.exited,
            ])
            if (code !== 0 || output.includes('✗')) console.error(output + errors)
            expect({ code, failed: output.includes('✗') }).toEqual({ code: 0, failed: false })
        },
        60000,
    )
}
