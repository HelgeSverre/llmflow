import { afterEach, expect, test } from 'bun:test'
import { config, readSetting, SETTINGS } from './config'

const touched = [
    'DASHBOARD_PORT',
    'MAX_TRACES',
    'DATA_DIR',
    'DB_PATH',
    'OTLP_EXPORT_ENDPOINT',
    'OTLP_EXPORT_LOGS_ENDPOINT',
    'VERBOSE',
    'AZURE_DEPLOYMENT_GPT_3_5_TURBO',
]
const saved = Object.fromEntries(touched.map((name) => [name, process.env[name]]))
afterEach(() => {
    for (const [name, value] of Object.entries(saved))
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
})

test('ports default, accept 0 and reject invalid values', () => {
    delete process.env.DASHBOARD_PORT
    expect(config.dashboardPort).toBe(1337)
    process.env.DASHBOARD_PORT = '0'
    expect(config.dashboardPort).toBe(0)
    for (const value of ['-1', '65536', '1.5', 'x']) {
        process.env.DASHBOARD_PORT = value
        expect(() => config.dashboardPort).toThrow('DASHBOARD_PORT must be a port')
    }
})

test('values are read on access, so later changes apply', () => {
    process.env.MAX_TRACES = '5'
    expect(config.maxTraces).toBe(5)
    process.env.MAX_TRACES = '0'
    expect(config.maxTraces).toBe(10000)
    process.env.MAX_TRACES = 'junk'
    expect(config.maxTraces).toBe(10000)
})

test('DATA_DIR expands a leading ~ and DB_PATH defaults inside it', () => {
    process.env.DATA_DIR = '~/.llmflow-test'
    delete process.env.DB_PATH
    expect(config.dataDir).toBe(`${process.env.HOME}/.llmflow-test`)
    expect(config.dbPath).toBe(`${process.env.HOME}/.llmflow-test/data.db`)
})

test('OTLP_EXPORT_ENDPOINT is a traces alias and any endpoint enables export', () => {
    process.env.OTLP_EXPORT_ENDPOINT = 'http://collector/v1/traces'
    delete process.env.OTLP_EXPORT_LOGS_ENDPOINT
    expect(config.otlpExport.endpoints).toEqual({
        traces: 'http://collector/v1/traces',
        logs: undefined,
        metrics: undefined,
    })
    expect(config.otlpExport.enabled).toBe(true)
})

test('empty strings count as unset', () => {
    process.env.DB_PATH = ''
    process.env.DATA_DIR = '/tmp/x'
    expect(config.dbPath).toBe('/tmp/x/data.db')
})

test('Azure deployments are looked up per model', () => {
    process.env.AZURE_DEPLOYMENT_GPT_3_5_TURBO = 'my-deployment'
    expect(config.azureDeployment('gpt-3.5-turbo')).toBe('my-deployment')
    expect(config.azureDeployment('gpt-4o')).toBeUndefined()
})

test('reading an undeclared variable is a programming error', () => {
    expect(() => readSetting('NOT_A_SETTING')).toThrow('NOT_A_SETTING is not declared in SETTINGS')
})

test('SETTINGS names are unique', () => {
    const names = SETTINGS.map((setting) => setting.name)
    expect(new Set(names).size).toBe(names.length)
})
