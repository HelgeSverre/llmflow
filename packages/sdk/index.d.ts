export interface SpanContext {
    spanId: string;
    traceId: string;
    parentId: string | null;
}

export interface SpanOptions {
    type: 'agent' | 'chain' | 'tool' | 'retrieval' | 'embedding' | 'llm' | 'trace' | 'custom' | string;
    name: string;
    traceId?: string;
    input?: any;
    attributes?: Record<string, any>;
    tags?: string[];
    serviceName?: string;
}

export function span<T>(opts: SpanOptions, fn: () => Promise<T>): Promise<T>;
export function span<T>(type: string, name: string, fn: () => Promise<T>): Promise<T>;

export function trace<T>(name: string, fn: () => Promise<T>, opts?: Partial<SpanOptions>): Promise<T>;

export function getCurrentSpan(): SpanContext | null;

export function currentTraceHeaders(): { 'x-trace-id'?: string; 'x-parent-id'?: string };

export function traced(type: string, name?: string): MethodDecorator;

export function wrapOpenAI<T>(client: T): T;

export function generateId(): string;
