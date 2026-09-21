import type { TokenUsage } from './base'

export type StreamFormat = 'openai' | 'anthropic' | 'gemini' | 'cohere'
type ToolCall = {
    index: number
    id?: string
    type: 'function'
    function: { name: string; arguments: string }
}

export class StreamSession {
    usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    content = ''
    model: string
    error: string | null = null
    done = false
    truncated = false
    finishReason: string | null = null
    tools = new Map<number, ToolCall>()
    private buffer = ''
    private decoder = new TextDecoder()
    private activeTool: { block: number; index: number } | null = null
    private nextToolIndex = 0
    private toolCaptureSize = 0
    private sentDone = false

    constructor(
        readonly format: StreamFormat,
        model: string,
        readonly id: string,
    ) {
        this.model = model
    }

    private mergeUsage(value: Record<string, number> | undefined) {
        if (!value) return
        const input = value.input_tokens ?? value.prompt_tokens ?? value.promptTokenCount
        const output = value.output_tokens ?? value.completion_tokens ?? value.candidatesTokenCount
        if (input !== undefined) this.usage.prompt_tokens = input
        if (output !== undefined) this.usage.completion_tokens = output
        for (const key of ['cache_creation_input_tokens', 'cache_read_input_tokens']) {
            if (value[key] !== undefined) this.usage[key] = value[key]
        }
        this.usage.total_tokens =
            value.total_tokens ??
            value.totalTokenCount ??
            this.usage.prompt_tokens + this.usage.completion_tokens
    }

    private chunk(delta: Record<string, unknown>, finish: string | null = null, usage = false) {
        return `data: ${JSON.stringify({
            id: this.id,
            object: 'chat.completion.chunk',
            model: this.model,
            choices: [{ index: 0, delta, finish_reason: finish }],
            ...(usage ? { usage: this.usage } : {}),
        })}\n\n`
    }

    private append(text: string) {
        const remaining = Math.max(0, 2 * 1024 * 1024 - this.content.length)
        this.content += text.slice(0, remaining)
        if (text.length > remaining) this.truncated = true
    }

    private end(): string[] {
        this.done = true
        if (this.sentDone) return []
        this.sentDone = true
        return ['data: [DONE]\n\n']
    }

    private accept(data: string): string[] {
        if (!data || data === '[DONE]') {
            return data ? this.end() : []
        }
        let event: any
        try {
            event = JSON.parse(data)
        } catch {
            throw new Error('Malformed upstream streaming event')
        }
        if (Array.isArray(event)) return event.flatMap((item) => this.accept(JSON.stringify(item)))
        if (event.error || event.type === 'error') {
            this.error = event.error?.message || 'Upstream streaming error'
            return [
                `data: ${JSON.stringify({ error: event.error || { message: this.error } })}\n\n`,
            ]
        }
        let delta: Record<string, unknown> = {}
        if (this.format === 'anthropic') {
            if (event.type === 'message_start') {
                this.model = event.message?.model || this.model
                this.mergeUsage(event.message?.usage)
                delta = { role: 'assistant', content: '' }
            } else if (
                event.type === 'content_block_start' &&
                event.content_block?.type === 'tool_use'
            ) {
                const index = this.nextToolIndex++
                this.activeTool = { block: event.index, index }
                const block = event.content_block
                const tool: ToolCall = {
                    index,
                    id: block.id,
                    type: 'function',
                    function: {
                        name: block.name,
                        arguments: Object.keys(block.input || {}).length
                            ? JSON.stringify(block.input)
                            : '',
                    },
                }
                delta = { tool_calls: [tool] }
            } else if (event.type === 'content_block_start' && event.content_block?.text) {
                delta = { content: event.content_block.text }
            } else if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta') delta = { content: event.delta.text }
                if (event.delta?.type === 'input_json_delta') {
                    const index =
                        this.activeTool?.block === event.index ? this.activeTool?.index : undefined
                    if (index !== undefined)
                        delta = {
                            tool_calls: [
                                { index, function: { arguments: event.delta.partial_json } },
                            ],
                        }
                }
            } else if (event.type === 'content_block_stop') {
                this.activeTool = null
                return []
            } else if (event.type === 'message_delta') {
                this.mergeUsage(event.usage)
                this.finishReason =
                    (
                        {
                            end_turn: 'stop',
                            stop_sequence: 'stop',
                            max_tokens: 'length',
                            tool_use: 'tool_calls',
                        } as Record<string, string>
                    )[event.delta?.stop_reason] ||
                    event.delta?.stop_reason ||
                    this.finishReason
                return [this.chunk({}, this.finishReason, true)]
            } else if (event.type === 'message_stop') {
                return this.end()
            } else return []
        } else if (this.format === 'gemini') {
            this.model = event.modelVersion || this.model
            this.mergeUsage(event.usageMetadata)
            delta = {
                content: (event.candidates?.[0]?.content?.parts || [])
                    .map((p: any) => p.text || '')
                    .join(''),
            }
            if (event.candidates?.[0]?.finishReason) {
                this.finishReason =
                    event.candidates[0].finishReason === 'MAX_TOKENS' ? 'length' : 'stop'
                this.done = true
            }
        } else if (this.format === 'cohere') {
            const usage = event.delta?.usage || event.response?.usage
            this.mergeUsage(usage ? { ...usage.billed_units, ...usage.tokens } : undefined)
            delta = {
                content:
                    (Array.isArray(event.delta?.message?.content)
                        ? event.delta.message.content.map((part: any) => part.text || '').join('')
                        : event.delta?.message?.content?.text) ||
                    event.text ||
                    '',
            }
            if (event.type === 'message-end' || event.event_type === 'stream-end') {
                const reason = event.delta?.finish_reason || event.finish_reason
                this.finishReason = reason === 'MAX_TOKENS' ? 'length' : 'stop'
                this.done = true
            }
        } else {
            this.model = event.model || this.model
            this.mergeUsage(event.usage || event.response?.usage)
            delta = event.choices?.[0]?.delta || {}
            if (event.type === 'response.output_text.delta') delta = { content: event.delta || '' }
            const responseTool = (item: any, index: number, complete: boolean) => ({
                index,
                id: item.call_id,
                function: { name: item.name, arguments: complete ? item.arguments : '' },
                replaceArguments: complete,
            })
            if (
                ['response.output_item.added', 'response.output_item.done'].includes(event.type) &&
                event.item?.type === 'function_call'
            ) {
                delta = {
                    tool_calls: [
                        responseTool(event.item, event.output_index, event.type.endsWith('.done')),
                    ],
                }
            } else if (event.type === 'response.function_call_arguments.delta') {
                delta = {
                    tool_calls: [
                        { index: event.output_index, function: { arguments: event.delta } },
                    ],
                }
            } else if (event.type === 'response.function_call_arguments.done') {
                delta = {
                    tool_calls: [
                        {
                            index: event.output_index,
                            function: { arguments: event.arguments },
                            replaceArguments: true,
                        },
                    ],
                }
            }
            if (
                [
                    'response.completed',
                    'response.done',
                    'response.incomplete',
                    'response.failed',
                ].includes(event.type)
            ) {
                this.done = true
                this.model = event.response?.model || this.model
                const calls = (event.response?.output || [])
                    .map((item: any, index: number) =>
                        item.type === 'function_call' ? responseTool(item, index, true) : null,
                    )
                    .filter(Boolean)
                if (calls.length) delta = { tool_calls: calls }
                this.finishReason =
                    event.response?.incomplete_details?.reason === 'max_output_tokens'
                        ? 'length'
                        : calls.length || this.tools.size
                          ? 'tool_calls'
                          : 'stop'
                if (event.type === 'response.failed' || event.response?.error) {
                    this.error = event.response?.error?.message || 'Upstream response failed'
                    this.finishReason = null
                }
            }
            this.finishReason = event.choices?.[0]?.finish_reason || this.finishReason
        }
        if (typeof delta.content === 'string') this.append(delta.content)
        for (const part of (delta.tool_calls || []) as any[]) {
            let tool = this.tools.get(part.index)
            if (!tool) {
                if (this.tools.size >= 1024 || this.toolCaptureSize >= 2 * 1024 * 1024) {
                    this.truncated = true
                    continue
                }
                tool = {
                    index: part.index,
                    type: 'function',
                    function: { name: '', arguments: '' },
                }
                this.tools.set(part.index, tool)
                this.toolCaptureSize += 64
            }
            const capture = (text: string, fieldRemaining = Infinity) => {
                const remaining = Math.max(
                    0,
                    Math.min(fieldRemaining, 2 * 1024 * 1024 - this.toolCaptureSize),
                )
                const kept = text.slice(0, remaining)
                this.toolCaptureSize += kept.length
                if (text.length > kept.length) this.truncated = true
                return kept
            }
            if (part.id) {
                this.toolCaptureSize -= tool.id?.length || 0
                tool.id = capture(part.id)
            }
            if (part.function?.name) {
                this.toolCaptureSize -= tool.function.name.length
                tool.function.name = capture(part.function.name)
            }
            if (part.replaceArguments && typeof part.function?.arguments === 'string') {
                this.toolCaptureSize -= tool.function.arguments.length
                tool.function.arguments = ''
            }
            if (part.function?.arguments) {
                tool.function.arguments += capture(
                    part.function.arguments,
                    1024 * 1024 - tool.function.arguments.length,
                )
            }
        }
        if (this.format === 'openai') return [`data: ${data}\n\n`]
        return [
            this.chunk(delta, this.finishReason, !!this.finishReason),
            ...(this.done ? this.end() : []),
        ]
    }

    push(bytes: Uint8Array, final = false): string[] {
        this.buffer += this.decoder.decode(bytes, { stream: !final })
        const output: string[] = []
        if (this.format === 'cohere' && this.buffer.trimStart().startsWith('{')) {
            let end: number
            while ((end = this.buffer.indexOf('\n')) >= 0) {
                const line = this.buffer.slice(0, end).trim()
                this.buffer = this.buffer.slice(end + 1)
                if (line) output.push(...this.accept(line))
            }
        }
        // SSE events may span arbitrary byte chunks, including CRLF and UTF-8 boundaries.
        let match: RegExpExecArray | null
        while (
            !this.buffer.trimStart().startsWith('[') &&
            (match = /\r?\n\r?\n/.exec(this.buffer))
        ) {
            const frame = this.buffer.slice(0, match.index)
            this.buffer = this.buffer.slice(match.index + match[0].length)
            const data = frame
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).replace(/^ /, ''))
                .join('\n')
            if (data) output.push(...this.accept(data))
        }
        if (this.buffer.length > 4 * 1024 * 1024)
            throw new Error('Upstream streaming event exceeds 4 MiB')
        if (final && this.buffer.trim()) {
            const tail = this.buffer.trim()
            this.buffer = ''
            if (tail.startsWith('data:')) output.push(...this.accept(tail.slice(5).trim()))
            else if (!tail.startsWith(':') && !tail.startsWith('event:')) {
                if (this.format === 'cohere') {
                    for (const line of tail.split(/\r?\n/)) output.push(...this.accept(line))
                } else output.push(...this.accept(tail))
            }
        }
        return output
    }

    response() {
        return {
            id: this.id,
            object: 'chat.completion',
            model: this.model,
            usage: this.usage,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: this.content,
                        ...(this.tools.size
                            ? {
                                  tool_calls: Array.from(this.tools.values()).map(
                                      ({ index, ...tool }) => tool,
                                  ),
                              }
                            : {}),
                    },
                    finish_reason: this.finishReason,
                },
            ],
            ...(this.truncated ? { _truncated: true } : {}),
            ...(this.error ? { error: this.error } : {}),
        }
    }
}
