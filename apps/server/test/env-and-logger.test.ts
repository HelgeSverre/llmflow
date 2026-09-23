import { afterAll, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '../../..')
const scratch = mkdtempSync(path.join(tmpdir(), 'llmflow-env-'))

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function sourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
        const file = path.join(directory, name)
        if (statSync(file).isDirectory()) return sourceFiles(file)
        return /\.(ts|js)$/.test(name) && !/\.test\./.test(name) ? [file] : []
    })
}

test('.env.example documents every variable the server and dev tooling read', () => {
    const example = readFileSync(path.join(root, '.env.example'), 'utf8')
    const documented = new Set(
        [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]),
    )
    const files = [
        ...sourceFiles(path.join(root, 'apps/server/src')),
        ...readdirSync(path.join(root, 'packages')).flatMap((name) => {
            const src = path.join(root, 'packages', name, 'src')
            return existsSync(src) ? sourceFiles(src) : []
        }),
        path.join(root, 'apps/dashboard/dev.ts'),
    ]
    const read = new Set<string>()
    for (const file of files) {
        const source = readFileSync(file, 'utf8')
        for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) read.add(match[1])
        // Names passed to port helpers and the replay credential table.
        for (const match of source.matchAll(/(?:configuredPort|port)\('([A-Z][A-Z0-9_]+)'/g))
            read.add(match[1])
    }
    for (const match of readFileSync(path.join(root, 'apps/server/src/replay.ts'), 'utf8').matchAll(
        /'([A-Z][A-Z0-9_]+_API_KEY)'/g,
    ))
        read.add(match[1])
    expect([...read].filter((name) => !documented.has(name)).sort()).toEqual([])
    expect(example).not.toMatch(/^DATA_DIR=~/m)
})

test('a DATA_DIR with a leading ~ resolves under the home directory, not ./~', async () => {
    const home = path.join(scratch, 'home')
    const cwd = path.join(scratch, 'cwd')
    for (const directory of [home, cwd]) Bun.spawnSync(['mkdir', '-p', directory])
    const child = Bun.spawnSync(
        [
            process.execPath,
            '-e',
            `const db = require(${JSON.stringify(path.join(root, 'packages/db/src/index.ts'))}); console.log(db.DATA_DIR); db.close()`,
        ],
        {
            cwd,
            env: { ...process.env, HOME: home, DATA_DIR: '~/.llmflow', DB_PATH: '' },
        },
    )
    expect(child.exitCode).toBe(0)
    expect(child.stdout.toString().trim()).toBe(path.join(home, '.llmflow'))
    expect(existsSync(path.join(home, '.llmflow', 'data.db'))).toBe(true)
    expect(existsSync(path.join(cwd, '~'))).toBe(false)
})

test('log.error prints the cause message and stack', () => {
    const log = require('@llmflow/shared/logger')
    const lines: string[] = []
    const spy = spyOn(console, 'log').mockImplementation((line: string) => {
        lines.push(line)
    })
    try {
        log.error('Replay failed', new Error('upstream refused'))
        log.error('Plain message')
        log.error('Odd cause', 'string cause')
    } finally {
        spy.mockRestore()
    }
    expect(lines[0]).toContain('Replay failed: Error: upstream refused')
    expect(lines[0]).toContain('env-and-logger.test.ts')
    expect(lines[1]).toEndWith('Plain message')
    expect(lines[2]).toEndWith('Odd cause: string cause')
})
