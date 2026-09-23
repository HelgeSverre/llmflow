export type Handler = (req: Request, url: URL, params: string[]) => Response | Promise<Response>

/** [method, exact path or pattern whose groups become params, handler] */
export type Route = [method: string, path: string | RegExp, handler: Handler]

function decode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

/** The first route whose method and path match, with its decoded path params. */
export function match(routes: Route[], method: string, pathname: string) {
    for (const [routeMethod, path, handler] of routes) {
        if (routeMethod !== method) continue
        if (typeof path === 'string') {
            if (path === pathname) return { handler, params: [] }
            continue
        }
        const found = pathname.match(path)
        if (found) return { handler, params: found.slice(1).map(decode) }
    }
    return null
}

/** Copies the listed query parameters that are present and non-empty. */
export function queryFilters<T>(url: URL, spec: Record<string, 'text' | 'number'>): T {
    const filters: Record<string, string | number> = {}
    for (const [key, kind] of Object.entries(spec)) {
        const value = url.searchParams.get(key)
        if (value) filters[key] = kind === 'number' ? Number(value) : value
    }
    return filters as T
}

export function page(url: URL, defaultLimit = 50) {
    return {
        limit: Number(url.searchParams.get('limit') || defaultLimit),
        offset: Number(url.searchParams.get('offset') || '0'),
    }
}

export const notFound = (what: string) =>
    Response.json({ error: `${what} not found` }, { status: 404 })
