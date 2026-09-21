import { mkdir, copyFile } from 'node:fs/promises'
const result = await Bun.build({
    entrypoints: ['./apps/server/src/server.ts'],
    outdir: './dist',
    target: 'bun',
    format: 'esm',
    sourcemap: 'external',
    packages: 'bundle',
})
if (!result.success) {
    console.error(result.logs)
    process.exit(1)
}
await mkdir('dist', { recursive: true })
await copyFile('packages/pricing/pricing.fallback.json', 'dist/pricing.fallback.json')
await copyFile('packages/otlp/PROTO-LICENSE', 'dist/PROTO-LICENSE')
