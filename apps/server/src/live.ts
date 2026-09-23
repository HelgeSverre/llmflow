// Pushes new spans, logs, metrics and throttled stats to connected dashboard WebSockets.
import * as db from '@llmflow/db'

type Client = { send: (data: string) => void }

const clients = new Set<Client>()
const STATS_THROTTLE_MS = 1000
let lastStatsUpdate = 0

export function addLiveClient(client: Client) {
    clients.add(client)
    client.send(JSON.stringify({ type: 'hello', time: Date.now() }))
}

export function removeLiveClient(client: Client) {
    clients.delete(client)
}

function broadcast(data: unknown) {
    const message = JSON.stringify(data)
    for (const client of clients) {
        try {
            client.send(message)
        } catch {
            clients.delete(client)
        }
    }
}

db.subscribeSpans((record) => {
    const trace = db.spanSummary(record)
    broadcast({ type: 'new_span', payload: trace })
    if (!trace.parent_id) broadcast({ type: 'new_trace', payload: trace })
    const now = Date.now()
    if (now - lastStatsUpdate > STATS_THROTTLE_MS) {
        lastStatsUpdate = now
        broadcast({ type: 'stats_update', payload: db.getStats() })
    }
})

db.subscribeLogs((record) => broadcast({ type: 'new_log', payload: db.logSummary(record) }))

db.subscribeMetrics((record) =>
    broadcast({ type: 'new_metric', payload: db.metricSummary(record) }),
)
