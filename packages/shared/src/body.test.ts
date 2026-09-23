import { expect, test } from 'bun:test'
import { readBoundedBody } from './body'

const stream = (...parts: string[]) =>
    new ReadableStream<Uint8Array>({
        start(controller) {
            for (const part of parts) controller.enqueue(new TextEncoder().encode(part))
            controller.close()
        },
    })

test('reads a body within the limit', async () => {
    expect((await readBoundedBody(stream('ab', 'cd'), 4))?.toString()).toBe('abcd')
})

test('returns null once the body exceeds the limit', async () => {
    expect(await readBoundedBody(stream('ab', 'cde'), 4)).toBeNull()
})

test('treats a missing body as empty', async () => {
    expect((await readBoundedBody(null, 4))?.length).toBe(0)
})
