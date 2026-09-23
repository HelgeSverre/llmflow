import {
    apiKeyFrom,
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
} from './base'

interface AnthropicUsage {
    input_tokens?: number
    output_tokens?: number
    prompt_tokens?: number
    completion_tokens?: number
    [key: string]: unknown
}

/**
 * Anthropic Claude provider.
 * Handles request/response transformation and different streaming format.
 */
export class AnthropicProvider extends BaseProvider {
    override streamFormat = 'anthropic' as const
    override name = 'anthropic'
    override displayName = 'Anthropic Claude'
    override hostname = 'api.anthropic.com'
    apiVersion = '2023-06-01'

    override getTarget(req: ProviderRequest): ProviderTarget {
        const target = this.passthroughTarget(req)
        return req.path === '/v1/chat/completions' ? { ...target, path: '/v1/messages' } : target
    }

    // Anthropic takes the key as x-api-key; a client's version and beta flags are kept.
    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKeyFrom(headers, 'x-api-key'),
            'anthropic-version': headers['anthropic-version'] || this.apiVersion,
            ...(headers['anthropic-beta'] ? { 'anthropic-beta': headers['anthropic-beta'] } : {}),
        }
    }

    override transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        const b = body as
            | {
                  messages?: Array<{
                      role: string
                      content: unknown
                      tool_call_id?: string
                      tool_calls?: Array<{
                          id: string
                          function: { name: string; arguments: string }
                      }>
                  }>
                  tools?: Array<{
                      type: string
                      function: { name: string; description?: string; parameters?: unknown }
                  }>
                  tool_choice?: string | { type: string; function?: { name: string } }
                  model?: string
                  max_tokens?: number
                  stream?: boolean
                  temperature?: number
                  top_p?: number
                  stop?: string | string[]
              }
            | null
            | undefined
        if (!b || !b.messages) {
            return body
        }

        const transformed: Record<string, unknown> = {
            model: b.model,
            max_tokens: b.max_tokens || 4096, // Required field for Anthropic
            stream: b.stream || false,
        }

        // Extract system message
        const systemMessages = b.messages.filter((m) => m.role === 'system')
        const otherMessages = b.messages.filter((m) => m.role !== 'system')

        if (systemMessages.length > 0) {
            transformed.system = systemMessages.map((m) => m.content).join('\n')
        }

        // Transform messages (Anthropic expects role to be 'user' or 'assistant')
        transformed.messages = otherMessages.map((msg) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content:
                msg.role === 'tool'
                    ? [{ type: 'tool_result', tool_use_id: msg.tool_call_id, content: msg.content }]
                    : msg.tool_calls
                      ? [
                            ...(msg.content ? [{ type: 'text', text: msg.content }] : []),
                            ...msg.tool_calls.map((tool) => ({
                                type: 'tool_use',
                                id: tool.id,
                                name: tool.function.name,
                                input: JSON.parse(tool.function.arguments || '{}'),
                            })),
                        ]
                      : msg.content,
        }))
        if (b.tools)
            transformed.tools = b.tools
                .filter((tool) => tool.type === 'function')
                .map((tool) => ({
                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: tool.function.parameters || { type: 'object' },
                }))
        if (b.tool_choice)
            transformed.tool_choice =
                typeof b.tool_choice === 'string'
                    ? { type: b.tool_choice === 'required' ? 'any' : b.tool_choice }
                    : { type: 'tool', name: b.tool_choice.function?.name }

        // Copy over optional parameters
        if (b.temperature !== undefined) transformed.temperature = b.temperature
        if (b.top_p !== undefined) transformed.top_p = b.top_p
        if (b.stop) {
            transformed.stop_sequences = Array.isArray(b.stop) ? b.stop : [b.stop]
        }

        return transformed
    }

    override normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const reqBody = (req.body || {}) as Record<string, unknown>
        const b = body as
            | {
                  id?: string
                  model?: string
                  content?: Array<{
                      type?: string
                      text?: string
                      id?: string
                      name?: string
                      input?: unknown
                  }>
                  stop_reason?: string
                  usage?: AnthropicUsage
                  error?: unknown
              }
            | null
            | undefined

        if (!b || b.error) {
            return { data: body, usage: null, model: reqBody.model as string | undefined }
        }

        // Extract text content from content blocks
        let textContent = ''
        if (Array.isArray(b.content)) {
            textContent = b.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text || '')
                .join('')
        }

        // Map stop_reason to finish_reason
        const finishReasonMap: Record<string, string> = {
            end_turn: 'stop',
            stop_sequence: 'stop',
            max_tokens: 'length',
            tool_use: 'tool_calls',
        }

        const normalizedUsage = this.extractUsage(b)

        const normalized = {
            id: b.id,
            object: 'chat.completion',
            model: b.model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent,
                        ...(b.content?.some((block) => block.type === 'tool_use')
                            ? {
                                  tool_calls: b.content
                                      .filter((block) => block.type === 'tool_use')
                                      .map((block) => ({
                                          id: block.id,
                                          type: 'function',
                                          function: {
                                              name: block.name,
                                              arguments: JSON.stringify(block.input || {}),
                                          },
                                      })),
                              }
                            : {}),
                    },
                    finish_reason:
                        (b.stop_reason && finishReasonMap[b.stop_reason]) || b.stop_reason,
                },
            ],
            usage: normalizedUsage,
        }

        return {
            data: normalized,
            usage: normalizedUsage,
            model: b.model,
        }
    }

    // Prompt-cache counters are kept when present, as the stream capture does.
    override extractUsage(response: unknown): TokenUsage {
        const usage = ((response || {}) as { usage?: AnthropicUsage }).usage || {}
        const input = usage.input_tokens || usage.prompt_tokens || 0
        const output = usage.output_tokens || usage.completion_tokens || 0
        const result: TokenUsage = {
            prompt_tokens: input,
            completion_tokens: output,
            total_tokens: input + output,
        }
        for (const key of ['cache_creation_input_tokens', 'cache_read_input_tokens'])
            if (typeof usage[key] === 'number') result[key] = usage[key] as number
        return result
    }
}
