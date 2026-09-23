import { afterEach, expect, test } from 'bun:test'
import { providerApiKey } from './credentials'

const saved = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
}
afterEach(() => {
    for (const [name, value] of Object.entries(saved))
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
})

test('GEMINI_API_KEY takes precedence over GOOGLE_API_KEY', () => {
    process.env.GEMINI_API_KEY = 'gemini'
    process.env.GOOGLE_API_KEY = 'google'
    expect(providerApiKey('gemini')).toBe('gemini')
    delete process.env.GEMINI_API_KEY
    expect(providerApiKey('gemini')).toBe('google')
    delete process.env.GOOGLE_API_KEY
    expect(providerApiKey('gemini')).toBeUndefined()
})

test('providers without a key variable have no key', () => {
    expect(providerApiKey('ollama')).toBeUndefined()
})
