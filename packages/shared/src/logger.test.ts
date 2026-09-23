import { expect, spyOn, test } from 'bun:test'
import { log } from './logger'

function capture(method: 'log' | 'error', run: () => void) {
    const lines: string[] = []
    const spy = spyOn(console, method).mockImplementation((line: string) => {
        lines.push(line)
    })
    try {
        run()
    } finally {
        spy.mockRestore()
    }
    return lines
}

test('log.error writes the cause message and stack to stderr', () => {
    const lines = capture('error', () => {
        log.error('Replay failed', new Error('upstream refused'))
        log.error('Plain message')
        log.error('Odd cause', 'string cause')
    })
    expect(lines[0]).toContain('Replay failed: Error: upstream refused')
    expect(lines[0]).toContain('logger.test.ts')
    expect(lines[1]).toEndWith('Plain message')
    expect(lines[2]).toEndWith('Odd cause: string cause')
})

test('info and warn carry the [llmflow] prefix', () => {
    const lines = capture('log', () => {
        log.info('ready')
        log.warn('port busy')
    })
    expect(lines[0]).toContain('[llmflow]')
    expect(lines[0]).toEndWith('ready')
    expect(lines[1]).toContain('[llmflow]')
    expect(lines[1]).toEndWith('port busy')
})
