import { createServer, type ProxyOptions, type ViteDevServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { backendUrl, port, publish } from '../../scripts/dev-runtime'

export async function startFrontend(ownBackend?: string) {
  const target = () =>
    ownBackend || backendUrl() || `http://127.0.0.1:${port('DASHBOARD_PORT', 1337)}`
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
  const preferred = port('VITE_PORT', 5173)
  const host = process.env.VITE_HOST || '127.0.0.1'
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
    try {
      await listen(preferred)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || preferred === 0) throw error
      console.log(`[llmflow] Vite port ${preferred} is busy; choosing an available port.`)
      await listen(0)
    }
    const address = http.address()
    if (!address || typeof address === 'string') throw new Error('No frontend port assigned')
    const hostname = ['0.0.0.0', '::'].includes(host)
      ? '127.0.0.1'
      : host.includes(':')
        ? `[${host}]`
        : host
    const url = `http://${hostname}:${address.port}`
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
    console.log(`[llmflow] Vite:       ${url}`)
    console.log(`[llmflow] API target: ${target()}`)
    return close
  } catch (error) {
    await close()
    throw error
  }
}
