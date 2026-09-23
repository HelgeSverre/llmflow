import { expect, test } from 'bun:test'
import { sanitizeHeaders } from './redaction'

test('sanitizeHeaders removes sensitive headers', () => {
    const sanitized = sanitizeHeaders({
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
        authorization: 'Bearer secret',
        'x-goog-api-key': 'google-key',
        'api-key': 'azure-key',
        'x-custom-header': 'safe',
    })

    expect(sanitized['content-type']).toBe('application/json')
    expect(sanitized['x-custom-header']).toBe('safe')
    expect(sanitized['x-api-key']).toBe('[REDACTED]')
    expect(sanitized['authorization']).toBe('[REDACTED]')
    expect(sanitized['x-goog-api-key']).toBe('[REDACTED]')
    expect(sanitized['api-key']).toBe('[REDACTED]')
})
