import { test, expect, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { migrate } from '../../../packages/db/src/migrations'
import { trustedWebSocketOrigin } from '../src/websocket-origin'
const { runChild } = require('./run-tests.js')
const directory = mkdtempSync(path.join(tmpdir(), 'llmflow-db-'))
Object.assign(process.env, {
    DATA_DIR: directory,
    DB_PATH: path.join(directory, 'test.db'),
    MAX_TRACES: '5',
})
const db = await import('@llmflow/db')
afterAll(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
})
function span(id: string, trace_id: string, options: Record<string, any> = {}) {
    db.insertTrace({ id, trace_id, timestamp: Date.now(), ...options })
}
test('sessions include descendants, root annotations win conflicts, and roots navigate correctly', () => {
    span('child', 'a', {
        parent_id: 'root',
        session_id: 'other',
        total_tokens: 10,
        estimated_cost: 1,
        timestamp: 100,
    })
    span('root', 'a', { session_id: 'session', span_type: 'agent', total_tokens: 0, timestamp: 50 })
    span('child2', 'a', { parent_id: 'root', total_tokens: 20, estimated_cost: 2, timestamp: 200 })
    const session = db.getSessions()[0]
    expect(session).toMatchObject({
        session_id: 'session',
        trace_count: 1,
        total_tokens: 30,
        total_cost: 3,
    })
    expect(db.getSessionCount()).toBe(1)
    expect(db.getSessionTraces('session')[0]).toMatchObject({
        root_span_id: 'root',
        span_count: 3,
        tokens: 30,
        cost: 3,
    })
    expect(db.getTraces({ filters: { session_id: 'session' } })).toHaveLength(3)
})
test('retention evicts logical traces, bounds oversized traces and marks late fragments', () => {
    span('broot', 'b', { timestamp: 300 })
    span('bchild', 'b', { parent_id: 'broot', timestamp: 301 })
    span('croot', 'c', { timestamp: 400 })
    expect(db.getSpansByTraceId('a')).toHaveLength(0)
    expect(db.getSpansByTraceId('b')).toHaveLength(2)
    expect(db.wasTraceEvicted('a')).toBe(true)
    span('late', 'a', { parent_id: 'root', timestamp: 500 })
    expect(db.wasTraceEvicted('a')).toBe(true)
    for (let i = 0; i < 6; i++)
        span(`large${i}`, 'large', { timestamp: 1000 + i, parent_id: i ? 'large0' : undefined })
    expect(db.getSpansByTraceId('large')).toHaveLength(0)
    expect(db.getTraceCount()).toBeLessThanOrEqual(5)
})
test('historical credential scrub and observed timestamp repair execute once', () => {
    const filename = path.join(directory, 'historical.db'),
        historical = new Database(filename)
    historical.exec(`CREATE TABLE traces(id TEXT PRIMARY KEY,timestamp INTEGER,trace_id TEXT,request_headers TEXT,response_headers TEXT,request_path TEXT);
        CREATE TABLE logs(timestamp INTEGER,observed_timestamp INTEGER);`)
    historical
        .query('INSERT INTO traces VALUES(?,?,?,?,?,?)')
        .run(
            'old',
            1,
            'old',
            JSON.stringify({ Authorization: 'historical-secret', Cookie: 'cookie-secret' }),
            JSON.stringify({ 'Set-Cookie': 'response-secret' }),
            '/v1?key=query-secret',
        )
    historical.exec('INSERT INTO logs VALUES(0,12345),(99,888)')
    migrate(historical)
    expect(historical.query('SELECT timestamp FROM logs ORDER BY timestamp').all()).toEqual([
        { timestamp: 99 },
        { timestamp: 12345 },
    ])
    expect(historical.query('SELECT COUNT(*) AS n FROM schema_migrations').get()).toEqual({ n: 3 })
    historical.exec('INSERT INTO logs VALUES(0,54321)')
    migrate(historical)
    expect(
        historical.query('SELECT timestamp FROM logs WHERE observed_timestamp=54321').get(),
    ).toEqual({ timestamp: 0 })
    historical.close()
    for (const secret of ['historical-secret', 'cookie-secret', 'response-secret', 'query-secret'])
        expect(readFileSync(filename).includes(Buffer.from(secret))).toBe(false)
})
test('websocket origin validation ignores hostile forwarding and rejects absent/null origins', () => {
    const request = (origin?: string) =>
        new Request('http://127.0.0.1:1337/ws', {
            headers: { ...(origin ? { origin } : {}), 'x-forwarded-host': 'evil.example' },
        })
    for (const origin of [
        undefined,
        'null',
        'https://evil.example',
        'http://127.0.0.1:9999',
        'http://localhost:1337/path',
    ])
        expect(trustedWebSocketOrigin(request(origin), '127.0.0.1', 1337)).toBe(false)
    for (const origin of ['http://localhost:1337', 'http://127.0.0.1:1337'])
        expect(trustedWebSocketOrigin(request(origin), '127.0.0.1', 1337)).toBe(true)
    process.env.WS_ALLOWED_ORIGINS = 'https://dashboard.example'
    expect(trustedWebSocketOrigin(request('https://dashboard.example'), '0.0.0.0', 1337)).toBe(true)
    delete process.env.WS_ALLOWED_ORIGINS
})
test('test runner reports signal termination and launch errors as failures', async () => {
    expect(await runChild(process.execPath, ['-e', 'process.exit(0)'])).toBe(0)
    expect(await runChild(process.execPath, ['-e', 'process.exit(3)'])).toBe(1)
    expect(await runChild(process.execPath, ['-e', "process.kill(process.pid,'SIGTERM')"])).toBe(1)
    expect(await runChild('/nonexistent/llmflow-test', [])).toBe(1)
})

test('concurrent runner invocations cannot touch inherited personal data', async () => {
    const sentinel = path.join(directory, 'personal.db')
    writeFileSync(sentinel, 'DO NOT CHANGE')
    const before = readFileSync(sentinel)
    const run = async () => {
        const child = Bun.spawn(
            [process.execPath, path.join(import.meta.dir, 'run-tests.js'), 'providers.js'],
            {
                env: { ...process.env, DATA_DIR: directory, DB_PATH: sentinel },
                stdout: 'pipe',
                stderr: 'pipe',
            },
        )
        const [output, errors, code] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ])
        expect({ code, errors, passed: output.includes('All tests passed') }).toEqual({
            code: 0,
            errors: '',
            passed: true,
        })
    }
    await Promise.all([run(), run()])
    expect(readFileSync(sentinel)).toEqual(before)
}, 15000)
