import { afterAll, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
    README_MARKERS,
    renderEnvExample,
    renderHelp,
    renderReadmeTable,
} from '@llmflow/shared/config-docs'

const root = path.resolve(import.meta.dir, '../../..')
const scratch = mkdtempSync(path.join(tmpdir(), 'llmflow-env-'))

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function sourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
        if (name === 'node_modules' || name === 'dist') return []
        const file = path.join(directory, name)
        if (statSync(file).isDirectory()) return sourceFiles(file)
        return /\.(ts|js|svelte)$/.test(name) && !/\.test\.|\.spec\./.test(name) ? [file] : []
    })
}

// The config module is the one reader. llmflow-sdk runs in the user's app and documents its own
// two variables; Vite reads its own; test harnesses build the environment of the server under test.
// Spreading process.env into a child's environment is not a read.
const ALLOWED = [
    'packages/shared/src/config.ts',
    'packages/sdk/',
    'apps/dashboard/vite.config.ts',
    'apps/server/test/',
    'e2e/',
]

test('server and tooling code reads environment variables only through the config module', () => {
    const files = ['apps', 'packages', 'scripts', 'e2e'].flatMap((dir) =>
        sourceFiles(path.join(root, dir)),
    )
    const readers = files
        .map((file) => path.relative(root, file))
        .filter((file) => !ALLOWED.some((allowed) => file.startsWith(allowed)))
        .filter((file) =>
            /process\.env\.[A-Z]|process\.env\[/.test(readFileSync(path.join(root, file), 'utf8')),
        )
    expect(readers).toEqual([])
})

test('.env.example, the README table and llmflow --help are generated from SETTINGS', () => {
    expect(readFileSync(path.join(root, '.env.example'), 'utf8')).toBe(renderEnvExample())
    expect(readFileSync(path.join(root, '.env.example'), 'utf8')).not.toMatch(/^DATA_DIR=~/m)

    // The formatter pads table columns, so compare cells rather than bytes.
    const rows = (markdown: string) =>
        markdown
            .split('\n')
            .filter((line) => line.startsWith('|') && !/^\|[\s|:-]+\|$/.test(line))
            .map((line) =>
                line
                    .split(/(?<!\\)\|/)
                    .map((cell) => cell.trim())
                    .join('|'),
            )
    const readme = readFileSync(path.join(root, 'README.md'), 'utf8')
    const block = readme.slice(readme.indexOf(README_MARKERS[0]), readme.indexOf(README_MARKERS[1]))
    expect(rows(block)).toEqual(rows(renderReadmeTable()))

    const help = Bun.spawnSync(['node', path.join(root, 'apps/server/bin/llmflow.js'), '--help'])
    expect(help.stdout.toString()).toContain(renderHelp())
})

test('a DATA_DIR with a leading ~ resolves under the home directory, not ./~', async () => {
    const home = path.join(scratch, 'home')
    const cwd = path.join(scratch, 'cwd')
    for (const directory of [home, cwd]) Bun.spawnSync(['mkdir', '-p', directory])
    const child = Bun.spawnSync(
        [
            process.execPath,
            '-e',
            `const db = await import(${JSON.stringify(path.join(root, 'packages/db/src/index.ts'))}); db.close()`,
        ],
        {
            cwd,
            env: { ...process.env, HOME: home, DATA_DIR: '~/.llmflow', DB_PATH: '' },
        },
    )
    expect(child.exitCode).toBe(0)
    expect(existsSync(path.join(home, '.llmflow', 'data.db'))).toBe(true)
    expect(existsSync(path.join(cwd, '~'))).toBe(false)
})
