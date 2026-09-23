import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import path from 'node:path'
import { migrate } from './migrations'

const dump = await Bun.file(path.join(import.meta.dir, 'fixtures/v0.4.1.sql')).text()

function loadV041() {
    const db = new Database(':memory:')
    db.exec(dump)
    return db
}

const tables = (db: Database) =>
    (
        db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
            name: string
        }[]
    ).map((row) => row.name)

const columns = (db: Database, table: string) =>
    (db.query(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[])
        .map((column) => `${column.name} ${column.type}`)
        .sort()

const versions = (db: Database) =>
    (
        db.query('SELECT version FROM schema_migrations ORDER BY version').all() as {
            version: number
        }[]
    ).map((row) => row.version)

test('a v0.4.1 database upgrades cleanly and keeps its data', () => {
    const db = loadV041()
    expect(versions(db)).toEqual([1, 2, 3, 4])
    expect(tables(db)).toContain('stats_cache')

    migrate(db)

    expect(versions(db)).toEqual([1, 2, 3, 4, 5, 6])
    expect(tables(db)).not.toContain('stats_cache')
    expect(
        db
            .query(
                'SELECT id, trace_id, parent_id, service_name, session_id FROM traces ORDER BY id',
            )
            .all(),
    ).toEqual([
        {
            id: 'span-child',
            trace_id: 'trace-legacy',
            parent_id: 'span-root',
            service_name: 'legacy-app',
            session_id: null,
        },
        {
            id: 'span-root',
            trace_id: 'trace-legacy',
            parent_id: null,
            service_name: 'legacy-app',
            session_id: 'session-legacy',
        },
    ])
    expect(db.query('SELECT COUNT(*) AS n FROM logs').get()).toEqual({ n: 1 })
    expect(db.query('SELECT name, value_int FROM metrics').get()).toEqual({
        name: 'legacy.counter',
        value_int: 7,
    })
    // The retention bookkeeping from migration 3 still matches the rows.
    expect(db.query('SELECT span_count FROM retention_counts').get()).toEqual({ span_count: 2 })

    migrate(db)
    expect(versions(db)).toEqual([1, 2, 3, 4, 5, 6])
    db.close()
})

test('an upgraded v0.4.1 database has the same schema as a new one', () => {
    const upgraded = loadV041()
    migrate(upgraded)
    const fresh = new Database(':memory:')
    migrate(fresh)

    expect(tables(upgraded)).toEqual(tables(fresh))
    for (const table of tables(fresh))
        expect(columns(upgraded, table)).toEqual(columns(fresh, table))
    const indexes = (db: Database) =>
        db
            .query(
                "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .all()
    expect(indexes(upgraded)).toEqual(indexes(fresh))
    upgraded.close()
    fresh.close()
})
