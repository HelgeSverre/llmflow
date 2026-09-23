import { test, expect } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const root = path.resolve(import.meta.dir, '../../..')

test.skipIf(!Bun.which('just'))(
    'every justfile recipe parses and clean honors an isolated DB_PATH',
    async () => {
        const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-recipes-'))
        try {
            const list = Bun.spawn(['just', '--summary'], {
                cwd: root,
                stdout: 'pipe',
                stderr: 'pipe',
            })
            const recipes = (await new Response(list.stdout).text()).trim().split(/\s+/)
            expect(await list.exited).toBe(0)
            for (const recipe of recipes) {
                const child = Bun.spawn(['just', '--dry-run', recipe], {
                    cwd: root,
                    stdout: 'pipe',
                    stderr: 'pipe',
                })
                const errors = await new Response(child.stderr).text()
                expect({
                    recipe,
                    code: await child.exited,
                    errors: errors.startsWith('error:') ? errors : '',
                }).toMatchObject({ code: 0, errors: '' })
            }
            mkdirSync(path.join(directory, 'node_modules'))
            const database = path.join(directory, 'isolated.db')
            for (const suffix of ['', '-wal', '-shm']) writeFileSync(database + suffix, 'fixture')
            const keep = path.join(directory, 'keep.db')
            writeFileSync(keep, 'unrelated database')
            const clean = Bun.spawn(
                [
                    'just',
                    '--justfile',
                    path.join(root, 'justfile'),
                    '--working-directory',
                    directory,
                    'clean',
                ],
                {
                    env: { ...process.env, DB_PATH: database },
                    stdout: 'pipe',
                    stderr: 'pipe',
                },
            )
            expect(await clean.exited).toBe(0)
            for (const suffix of ['', '-wal', '-shm'])
                expect(existsSync(database + suffix)).toBe(false)
            expect(existsSync(path.join(directory, 'node_modules'))).toBe(false)
            expect(readFileSync(keep, 'utf8')).toBe('unrelated database')
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    },
)

test('Docker launcher retries only host-port collisions and reports published endpoints', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-docker-test-'))
    const calls = path.join(directory, 'calls.jsonl')
    try {
        writeFileSync(
            path.join(directory, 'docker'),
            `#!/usr/bin/env bun
import {appendFileSync} from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(process.env.MOCK_CALLS, JSON.stringify({args, dashboard: process.env.DASHBOARD_PORT, proxy: process.env.PROXY_PORT})+'\\n')
if (args.includes('up')) {
    if (process.env.MOCK_FAILURE === 'daemon') { console.error('Cannot connect to Docker daemon'); process.exit(1) }
    if (process.env.DASHBOARD_PORT !== '0') { console.error('Bind failed: port is already allocated'); process.exit(1) }
} else if (args.includes('port')) console.log(args.at(-1) === '1337' ? '127.0.0.1:49100' : '127.0.0.1:49101')
`,
            { mode: 0o755 },
        )
        async function run(failure: string) {
            writeFileSync(calls, '')
            const child = Bun.spawn([process.execPath, 'scripts/docker-dev.ts'], {
                cwd: root,
                env: {
                    ...process.env,
                    PATH: `${directory}:${process.env.PATH}`,
                    MOCK_CALLS: calls,
                    MOCK_FAILURE: failure,
                    DASHBOARD_PORT: '3000',
                    PROXY_PORT: '8080',
                },
                stdout: 'pipe',
                stderr: 'pipe',
            })
            const output = await new Response(child.stdout).text()
            const errors = await new Response(child.stderr).text()
            return {
                code: await child.exited,
                output,
                errors,
                calls: readFileSync(calls, 'utf8')
                    .trim()
                    .split('\n')
                    .map((line) => JSON.parse(line)),
            }
        }
        const success = await run('collision')
        expect(success.code).toBe(0)
        expect(success.calls.filter((call) => call.args.includes('up'))).toHaveLength(2)
        expect(success.calls[1]).toMatchObject({ dashboard: '0', proxy: '0' })
        expect(success.output).toContain('http://127.0.0.1:49100')
        expect(success.output).toContain('http://127.0.0.1:49101')
        const failure = await run('daemon')
        expect(failure.code).toBe(1)
        expect(failure.calls).toHaveLength(1)
        expect(failure.errors).toContain('Cannot connect to Docker daemon')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
