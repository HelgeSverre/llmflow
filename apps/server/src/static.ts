import fs from 'node:fs'
import path from 'node:path'

declare const LLMFLOW_BUNDLE_DIR: string

// The bundle serves its adjacent assets; source mode uses the dashboard workspace build.
const publicDir =
    typeof LLMFLOW_BUNDLE_DIR !== 'undefined'
        ? path.join(LLMFLOW_BUNDLE_DIR, 'public')
        : path.join(
              path.dirname(Bun.resolveSync('@llmflow/dashboard/package.json', import.meta.dir)),
              'dist',
          )

export function serveStatic(pathname: string): Response {
    const fullPath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname)
    try {
        if (!fs.existsSync(fullPath)) return new Response('Not Found', { status: 404 })
        return new Response(Bun.file(fullPath))
    } catch {
        return new Response('Not Found', { status: 404 })
    }
}
