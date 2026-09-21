function nanoToMs(value) {
    if (value === undefined || value === null || value === '') return null
    try {
        if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
        const nanos = BigInt(value)
        const milliseconds = Number(nanos / 1000000n)
        return nanos > 0n && Number.isSafeInteger(milliseconds) && milliseconds > 0
            ? milliseconds
            : null
    } catch {
        return null
    }
}
module.exports = { nanoToMs }
