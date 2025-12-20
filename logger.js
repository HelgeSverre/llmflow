/**
 * Colored console logger for LLMFlow
 * Clean, compact output with optional verbose mode
 */

const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');

const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
};

function timestamp() {
    return new Date().toISOString().slice(11, 23);
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens) {
    if (!tokens) return '';
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return String(tokens);
}

const logger = {
    // Startup messages
    startup(message) {
        console.log(`${c.cyan}[llmflow]${c.reset} ${message}`);
    },

    info(message) {
        console.log(`${c.dim}[llmflow]${c.reset} ${message}`);
    },

    warn(message) {
        console.log(`${c.yellow}[llmflow]${c.reset} ${message}`);
    },

    error(message) {
        console.log(`${c.red}[llmflow]${c.reset} ${message}`);
    },

    // Request logging - compact by default
    request(method, path, traceId) {
        if (VERBOSE) {
            console.log(`${c.dim}${timestamp()}${c.reset} ${c.blue}>>>${c.reset} ${method} ${path} ${c.dim}${traceId.slice(0, 8)}${c.reset}`);
        }
    },

    // Response logging - always shown but compact
    response(opts) {
        const { method, path, status, duration, model, tokens, streaming, traceId } = opts;
        
        const statusColor = status < 400 ? c.green : c.red;
        const statusText = `${statusColor}${status}${c.reset}`;
        const durationText = `${c.dim}${formatDuration(duration)}${c.reset}`;
        
        let details = '';
        if (model) details += ` ${c.cyan}${model}${c.reset}`;
        if (tokens) details += ` ${c.dim}${formatTokens(tokens)} tok${c.reset}`;
        if (streaming) details += ` ${c.magenta}stream${c.reset}`;
        
        if (VERBOSE) {
            console.log(`${c.dim}${timestamp()}${c.reset} ${c.green}<<<${c.reset} ${statusText} ${durationText}${details} ${c.dim}${traceId.slice(0, 8)}${c.reset}`);
        } else {
            // Compact: single line with key info
            const shortPath = path.length > 20 ? '...' + path.slice(-17) : path;
            console.log(`${c.dim}${timestamp()}${c.reset} ${method} ${shortPath.padEnd(20)} ${statusText} ${durationText.padStart(8)}${details}`);
        }
    },

    // API proxy specific
    proxy(opts) {
        const { model, tokens, cost, duration, streaming, error } = opts;
        
        if (error) {
            console.log(`${c.dim}${timestamp()}${c.reset} ${c.red}ERR${c.reset} ${error.slice(0, 50)}`);
            return;
        }

        const parts = [
            `${c.dim}${timestamp()}${c.reset}`,
            streaming ? `${c.magenta}STREAM${c.reset}` : `${c.green}OK${c.reset}`,
            model ? `${c.cyan}${model}${c.reset}` : '',
            tokens ? `${formatTokens(tokens)} tok` : '',
            cost ? `$${cost.toFixed(4)}` : '',
            `${c.dim}${formatDuration(duration)}${c.reset}`,
        ].filter(Boolean);

        console.log(parts.join(' '));
    },

    // Dashboard API (only in verbose)
    dashboard(method, path, duration) {
        if (VERBOSE) {
            console.log(`${c.dim}${timestamp()} ${method} ${path} ${formatDuration(duration)}${c.reset}`);
        }
    },

    // Verbose only debug info
    debug(message) {
        if (VERBOSE) {
            console.log(`${c.dim}${timestamp()} ${message}${c.reset}`);
        }
    },

    isVerbose() {
        return VERBOSE;
    }
};

module.exports = logger;
