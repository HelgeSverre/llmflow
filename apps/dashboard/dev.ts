import { createServer, type ProxyOptions, type ViteDevServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { available, backendUrl, publish } from '@llmflow/dev-runtime'
import { config } from '@llmflow/shared/config'
import { clientHost } from '@llmflow/shared/net'
import { log } from '@llmflow/shared/logger'

async function startFrontend() {
  const target = () => backendUrl() || `http://127.0.0.1:${config.dashboardPort}`
  function proxyOptions(): ProxyOptions {
    return {
      target: target(),
      ws: true,
      configure(proxy) {
        proxy.before('web', 'stream', (_req, _res, options) => {
          options.target = new URL(target())
        })
        proxy.before('ws', 'stream', (_req, _socket, options) => {
          options.target = new URL(target())
        })
      },
    }
  }
  const preferred = config.vitePort
  const host = config.viteHost
  let vite: ViteDevServer | undefined
  const http = createHttpServer((req, res) => {
    if (vite) vite.middlewares(req, res)
    else res.writeHead(503).end('Development server is starting')
  })
  const sockets = new Set<import('node:net').Socket>()
  http.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const error = (error: Error) => {
        http.off('listening', listening)
        reject(error)
      }
      const listening = () => {
        http.off('error', error)
        resolve()
      }
      http.once('error', error)
      http.once('listening', listening)
      http.listen(port, host)
    })
  let unpublish = () => {}
  const close = async () => {
    unpublish()
    for (const socket of sockets) socket.destroy()
    await vite?.close()
    if (http.listening) await new Promise<void>((resolve) => http.close(() => resolve()))
  }
  try {
    await available('Vite', preferred, listen)
    const address = http.address()
    if (!address || typeof address === 'string') throw new Error('No frontend port assigned')
    const url = `http://${clientHost(host)}:${address.port}`
    vite = await createServer({
      root: fileURLToPath(new URL('.', import.meta.url)),
      configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
      clearScreen: false,
      server: {
        host,
        port: address.port,
        middlewareMode: { server: http },
        hmr: { server: http },
        proxy: { '/api': proxyOptions(), '/ws': proxyOptions() },
      },
    })
    unpublish = publish({ kind: 'frontend', url })
    log.info(`Vite:       ${url}`)
    log.info(`API target: ${target()}`)
    return close
  } catch (error) {
    await close()
    throw error
  }
}

let close: (() => Promise<void>) | undefined
let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  const timeout = setTimeout(() => process.exit(code), 5000)
  try {
    await close?.()
  } catch (error) {
    log.error('Cleanup failed', error)
  }
  clearTimeout(timeout)
  process.exit(code)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
try {
  close = await startFrontend()
  log.info('Ready. Press Ctrl+C to stop.')
} catch (error) {
  log.error(`Startup failed: ${(error as Error).message}`)
  await stop(1)
}
