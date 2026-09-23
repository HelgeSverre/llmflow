import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { freePort, waitForHealth } from '@llmflow/shared/net'
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-package-'))
const root = path.resolve(import.meta.dir, '..')
const packageRoot = path.join(root, 'apps/server')
let server: ReturnType<typeof Bun.spawn> | undefined
async function run(args: string[], cwd: string, env = process.env) {
    const child = Bun.spawn(args, { cwd, env, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ])
    if (code !== 0) throw new Error(`${args.join(' ')} (${code}): ${stderr}`)
    return stdout
}
try {
    // bun pm pack is the publish path: it runs prepack and rewrites workspace:/catalog: specifiers.
    const tarball = (
        await run(['bun', 'pm', 'pack', '--quiet', '--destination', directory], packageRoot)
    )
        .trim()
        .split('\n')
        .at(-1)!
    const tarballPath = path.isAbsolute(tarball)
        ? tarball
        : path.join(directory, path.basename(tarball))
    const paths = (await run(['tar', '-tzf', tarballPath], directory))
        .trim()
        .split('\n')
        .map((file) => file.replace(/^package\//, ''))
    for (const required of [
        'package.json',
        'bin/llmflow.js',
        'dist/server.js',
        'dist/public/index.html',
        'dist/licenses/opentelemetry-proto.txt',
    ])
        if (!paths.includes(required)) throw new Error(`Missing packed artifact: ${required}`)
    const allowed = /^(bin\/|dist\/|package\.json$|README\.md$|LICENSE$)/
    const unexpected = paths.filter((file) => !allowed.test(file))
    if (unexpected.length) throw new Error(`Tarball includes unexpected files: ${unexpected}`)
    const manifest = await run(['tar', '-xzOf', tarballPath, 'package/package.json'], directory)
    const specifier = manifest.match(/"(workspace|catalog):[^"]*"/)
    if (specifier) throw new Error(`Packed manifest keeps a ${specifier[0]} specifier`)
    const consumer = path.join(directory, 'consumer')
    mkdirSync(consumer)
    writeFileSync(path.join(consumer, 'package.json'), '{"private":true}')
    await run(['npm', 'install', '--ignore-scripts', '--offline', tarballPath], consumer)
    const cli = path.join(consumer, 'node_modules/.bin/llmflow')
    const dashboardPort = await freePort(),
        proxyPort = await freePort()
    const env = {
        ...process.env,
        DATA_DIR: path.join(directory, 'data'),
        DB_PATH: path.join(directory, 'test.db'),
        DASHBOARD_PORT: String(dashboardPort),
        PROXY_PORT: String(proxyPort),
        BUN_INSTALL_CACHE_DIR: path.join(directory, 'empty-cache'),
        PRICING_URL: 'https://127.0.0.1:1/pricing.json',
        OTLP_EXPORT_ENABLED: 'false',
        OTLP_EXPORT_ENDPOINT: '',
        OTLP_EXPORT_TRACES_ENDPOINT: '',
        OTLP_EXPORT_LOGS_ENDPOINT: '',
        OTLP_EXPORT_METRICS_ENDPOINT: '',
    }
    const noBun = path.join(directory, 'node-only')
    mkdirSync(noBun)
    const node = (await run(['which', 'node'], root)).trim()
    symlinkSync(node, path.join(noBun, 'node'))
    const missing = Bun.spawn([cli], {
        cwd: consumer,
        env: { ...env, PATH: noBun },
        stderr: 'pipe',
        stdout: 'pipe',
    })
    const diagnostic = await new Response(missing.stderr).text()
    if ((await missing.exited) !== 1 || !diagnostic.includes('Bun is required'))
        throw new Error(`Missing-Bun diagnostic failed: ${diagnostic}`)
    if (!(await run([cli, '--help'], consumer, { ...env, PATH: noBun })).includes('Usage:'))
        throw new Error('Help failed')
    if (!(await run([cli, '--version'], consumer, { ...env, PATH: noBun })).includes('llmflow v'))
        throw new Error('Version failed')
    server = Bun.spawn([cli], { cwd: consumer, env, stdout: 'pipe', stderr: 'pipe' })
    const base = `http://127.0.0.1:${dashboardPort}`
    try {
        await waitForHealth(base, 10_000)
    } catch {
        server.kill()
        throw new Error(await new Response(server.stderr as ReadableStream<Uint8Array>).text())
    }
    const health = (await (await fetch(`${base}/api/health`)).json()) as {
        pricing: { source: string; model_count: number }
    }
    if (health.pricing.source !== 'fallback' || health.pricing.model_count < 1)
        throw new Error(`Bundled pricing unavailable: ${JSON.stringify(health.pricing)}`)
    const html = await (await fetch(base)).text()
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
    if (!assets.length) throw new Error('Dashboard assets missing')
    for (const [, asset] of assets)
        if (!(await fetch(base + asset)).ok) throw new Error(`Missing ${asset}`)
    if (!(await fetch(`${base}/api/spans`)).ok) throw new Error('Trace API unavailable')
    console.log(
        'Clean tarball, dashboard assets, API, CLI help/version and missing-Bun checks passed',
    )
} finally {
    if (server) {
        server.kill('SIGTERM')
        await server.exited
    }
    rmSync(directory, { recursive: true, force: true })
}
