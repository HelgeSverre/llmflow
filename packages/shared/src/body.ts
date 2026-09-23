// Reads a body stream up to `limit` bytes. Returns null (after cancelling the stream)
// when the body is larger, so callers can choose their own error.
export async function readBoundedBody(
    body: ReadableStream<Uint8Array> | null,
    limit: number,
): Promise<Buffer | null> {
    if (!body) return Buffer.alloc(0)
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > limit) {
                await reader.cancel()
                return null
            }
            chunks.push(value)
        }
        return Buffer.concat(chunks)
    } finally {
        reader.releaseLock()
    }
}
