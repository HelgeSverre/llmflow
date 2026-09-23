import { config } from './config'

const dim = '\x1b[2m'
const yellow = '\x1b[33m'
const red = '\x1b[31m'
const reset = '\x1b[0m'

function timestamp() {
    return new Date().toISOString().slice(11, 23)
}

// An Error cause prints its stack (which includes the message); anything else is stringified.
function describe(cause: unknown) {
    if (cause === undefined) return ''
    return `: ${cause instanceof Error ? cause.stack || cause.message : String(cause)}`
}

export const log = {
    info(message: string) {
        console.log(`${dim}[llmflow]${reset} ${message}`)
    },

    warn(message: string) {
        console.log(`${yellow}[llmflow]${reset} ${message}`)
    },

    error(message: string, cause?: unknown) {
        console.error(`${red}[llmflow]${reset} ${message}${describe(cause)}`)
    },

    debug(message: string) {
        if (config.verbose) console.log(`${dim}${timestamp()} ${message}${reset}`)
    },
}

export default log
