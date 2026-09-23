import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dir, '..')
const output = path.join(packageRoot, 'dist')

// CI builds once, then sets LLMFLOW_REUSE_BUILD=1 so prepack (test:package) and the
// Playwright webServer reuse that dist instead of rebuilding it.
if (process.env.LLMFLOW_REUSE_BUILD === '1') {
    if (!existsSync(path.join(output, 'server.js'))) {
        console.error(
            'LLMFLOW_REUSE_BUILD=1 but apps/server/dist is missing; run bun run build first',
        )
        process.exit(1)
    }
    console.log('Reusing existing apps/server/dist (LLMFLOW_REUSE_BUILD=1)')
    process.exit(0)
}
const workspace = (name: string) =>
    path.dirname(Bun.resolveSync(`${name}/package.json`, packageRoot))

await rm(output, { recursive: true, force: true })
const dashboard = Bun.spawn([process.execPath, 'run', '--filter', '@llmflow/dashboard', 'build'], {
    cwd: packageRoot,
    stdout: 'inherit',
    stderr: 'inherit',
})
if ((await dashboard.exited) !== 0) process.exit(1)

const result = await Bun.build({
    entrypoints: [path.join(packageRoot, 'src/server.ts')],
    outdir: output,
    target: 'bun',
    format: 'esm',
    sourcemap: 'external',
    packages: 'bundle',
    // Static assets (dist/public) are located relative to the bundle; pricing is embedded.
    banner: 'const LLMFLOW_BUNDLE_DIR = import.meta.dir;',
})
if (!result.success) {
    console.error(result.logs)
    process.exit(1)
}
await mkdir(output, { recursive: true })
await cp(path.join(workspace('@llmflow/dashboard'), 'dist'), path.join(output, 'public'), {
    recursive: true,
})
await cp(path.join(packageRoot, 'licenses'), path.join(output, 'licenses'), { recursive: true })
