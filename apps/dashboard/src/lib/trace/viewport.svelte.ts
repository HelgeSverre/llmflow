import { SvelteSet } from 'svelte/reactivity'

export interface SpanInput {
    id: string
    parent_id?: string | undefined
    name: string
    start_time: number       // ms since trace root (or absolute — both work since we subtract rootStart)
    duration_ms: number
    span_type?: string
    [key: string]: unknown
}

export interface SpanRow {
    id: string
    parent_id?: string | undefined
    name: string
    depth: number
    start_time: number
    duration_ms: number
    span_type?: string
    hasChildren: boolean
    xPx: number              // left offset within waterfall canvas
    widthPx: number          // bar width (min 2px enforced for visibility)
}

interface InternalNode {
    span: SpanInput
    depth: number
    children: InternalNode[]
}

const MIN_BAR_PX = 2

export class TraceViewport {
    #spans: SpanInput[]
    #tree: InternalNode[]
    // SvelteSet (not plain Set) so reactive readers (Svelte templates, effects) recompute
    // when expanded changes. rows + selectedSpan are plain getters rather than $derived
    // fields because $derived runes don't evaluate outside Svelte's compiler context
    // (vitest/jsdom under @sveltejs/vite-plugin-svelte). Behavior is equivalent inside
    // Svelte components since getters are tracked when read in reactive contexts.
    #expanded = new SvelteSet<string>()
    #viewportWidth = $state(0)
    selectedId: string | null = $state(null)

    constructor(spans: SpanInput[]) {
        this.#spans = spans
        this.#tree = this.#buildTree(spans)
        // Default: every node with children is expanded.
        for (const node of this.#walk(this.#tree)) {
            if (node.children.length) this.#expanded.add(node.span.id)
        }
    }

    get rootStart(): number {
        if (this.#spans.length === 0) return 0
        return Math.min(...this.#spans.map(s => s.start_time))
    }

    get totalDuration(): number {
        if (this.#spans.length === 0) return 1
        const end = Math.max(...this.#spans.map(s => s.start_time + s.duration_ms))
        return Math.max(1, end - this.rootStart)
    }

    setViewportWidth(px: number) {
        this.#viewportWidth = px
    }

    expand(id: string) { this.#expanded.add(id) }
    collapse(id: string) { this.#expanded.delete(id) }
    toggle(id: string) {
        if (this.#expanded.has(id)) this.collapse(id)
        else this.expand(id)
    }

    select(id: string | null) { this.selectedId = id }

    get rows(): SpanRow[] {
        const pxPerMs = this.#viewportWidth > 0 ? this.#viewportWidth / this.totalDuration : 0
        const out: SpanRow[] = []
        const root = this.rootStart
        const walk = (node: InternalNode) => {
            const s = node.span
            out.push({
                id: s.id,
                parent_id: s.parent_id,
                name: s.name,
                depth: node.depth,
                start_time: s.start_time,
                duration_ms: s.duration_ms,
                span_type: s.span_type,
                hasChildren: node.children.length > 0,
                xPx: (s.start_time - root) * pxPerMs,
                widthPx: Math.max(MIN_BAR_PX, s.duration_ms * pxPerMs)
            })
            if (this.#expanded.has(s.id)) {
                for (const c of node.children) walk(c)
            }
        }
        for (const n of this.#tree) walk(n)
        return out
    }

    get selectedSpan(): SpanInput | null {
        if (!this.selectedId) return null
        return this.#spans.find(s => s.id === this.selectedId) || null
    }

    #buildTree(spans: SpanInput[]): InternalNode[] {
        const byId = new Map<string, InternalNode>()
        for (const span of spans) byId.set(span.id, { span, depth: 0, children: [] })
        const roots: InternalNode[] = []
        for (const node of byId.values()) {
            const pid = node.span.parent_id
            if (pid && byId.has(pid)) {
                const parent = byId.get(pid)!
                node.depth = parent.depth + 1
                parent.children.push(node)
            } else {
                roots.push(node)
            }
        }
        const sort = (n: InternalNode) => {
            n.children.sort((a, b) => a.span.start_time - b.span.start_time)
            for (const c of n.children) sort(c)
        }
        for (const r of roots) sort(r)
        return roots
    }

    *#walk(nodes: InternalNode[]): IterableIterator<InternalNode> {
        for (const n of nodes) {
            yield n
            yield* this.#walk(n.children)
        }
    }
}
