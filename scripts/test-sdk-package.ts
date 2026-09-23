// Packs llmflow-sdk, installs the tarball into a clean project and checks that Node can
// import it, that it reports spans to LLMFlow, and that TypeScript resolves its types.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')
const packageRoot = path.join(root, 'packages/sdk')
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-sdk-package-'))

async function run(
    args: string[],
    cwd: string,
    env: Record<string, string | undefined> = process.env,
) {
    const child = Bun.spawn(args, { cwd, env, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ])
    if (code !== 0) throw new Error(`${args.join(' ')} (${code}): ${stderr}${stdout}`)
    return stdout
}

const received: { span_name?: string }[] = []
const collector = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
        if (request.method === 'POST' && new URL(request.url).pathname === '/api/spans')
            received.push(await request.json())
        return Response.json({})
    },
})

try {
    const tarball = path.join(
        directory,
        path.basename(
            (await run(['bun', 'pm', 'pack', '--quiet', '--destination', directory], packageRoot))
                .trim()
                .split('\n')
                .at(-1)!,
        ),
    )
    const paths = (await run(['tar', '-tzf', tarball], directory))
        .trim()
        .split('\n')
        .map((file) => file.replace(/^package\//, ''))
        .sort()
    const expected = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'package.json']
    if (JSON.stringify(paths) !== JSON.stringify(expected))
        throw new Error(`Unexpected SDK tarball contents: ${paths.join(', ')}`)

    const manifest = JSON.parse(
        await run(['tar', '-xzOf', tarball, 'package/package.json'], directory),
    )
    const conditions = Object.keys(manifest.exports['.'])
    if (conditions.join() !== 'types,import,default')
        throw new Error(`SDK exports conditions must be types, import, default; got ${conditions}`)
    if (/"(workspace|catalog):/.test(JSON.stringify(manifest)))
        throw new Error('Packed SDK manifest keeps a workspace:/catalog: specifier')

    const consumer = path.join(directory, 'consumer')
    mkdirSync(consumer)
    writeFileSync(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}')
    await run(['npm', 'install', '--ignore-scripts', '--offline', '--no-audit', tarball], consumer)

    writeFileSync(
        path.join(consumer, 'smoke.mjs'),
        `import * as sdk from 'llmflow-sdk'
const names = ['currentTraceHeaders', 'generateId', 'getCurrentSpan', 'span', 'trace', 'traced', 'wrapOpenAI']
for (const name of names) if (typeof sdk[name] !== 'function') throw new Error('missing export ' + name)
await sdk.trace('sdk-package-smoke', () => sdk.span('tool', 'inner', async () => 1))
`,
    )
    await run(['node', 'smoke.mjs'], consumer, {
        ...process.env,
        LLMFLOW_URL: collector.url.origin,
    })
    for (let attempt = 0; attempt < 100 && received.length < 2; attempt++) await Bun.sleep(10)
    const names = received.map((span) => span.span_name).sort()
    if (names.join() !== 'inner,sdk-package-smoke')
        throw new Error(`SDK smoke spans not received: ${JSON.stringify(received)}`)

    writeFileSync(
        path.join(consumer, 'consumer.ts'),
        `import { span, trace, type SpanContext, type SpanOptions } from 'llmflow-sdk'
const options: SpanOptions = { type: 'retrieval', name: 'search' }
const result: Promise<number> = trace('typed', () => span(options, async () => 1))
const context: SpanContext | null = null
void result, context
`,
    )
    writeFileSync(
        path.join(consumer, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                strict: true,
                noEmit: true,
                types: [],
            },
            files: ['consumer.ts'],
        }),
    )
    await run([path.join(root, 'node_modules/.bin/tsc'), '-p', consumer], consumer)
    console.log(
        'SDK tarball contents, exports map, Node import, span delivery and consumer types passed',
    )
} finally {
    collector.stop(true)
    rmSync(directory, { recursive: true, force: true })
}
