import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')
const output = path.join(root, 'dist')
await rm(output, { recursive: true, force: true })
const dashboard = Bun.spawn([process.execPath, 'run', '--filter', '@llmflow/dashboard', 'build'], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
})
if ((await dashboard.exited) !== 0) process.exit(1)

const result = await Bun.build({
    entrypoints: [path.join(root, 'apps/server/src/server.ts')],
    outdir: output,
    target: 'bun',
    format: 'esm',
    sourcemap: 'external',
    packages: 'bundle',
    // CJS __dirname retains the source location when bundled; assets follow the output file.
    banner: 'const LLMFLOW_BUNDLE_DIR = import.meta.dir;',
})
if (!result.success) {
    console.error(result.logs)
    process.exit(1)
}
await mkdir(output, { recursive: true })
await cp(path.join(root, 'apps/dashboard/dist'), path.join(output, 'public'), { recursive: true })
await copyFile(
    path.join(root, 'packages/pricing/pricing.fallback.json'),
    path.join(output, 'pricing.fallback.json'),
)
await cp(path.join(root, 'licenses'), path.join(output, 'licenses'), { recursive: true })
