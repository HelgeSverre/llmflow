import {
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
} from './base'

export interface AnthropicProviderConfig {
    hostname?: string
    apiVersion?: string
}

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
    hostname: string
    apiVersion: string

    constructor(config: AnthropicProviderConfig = {}) {
        super()
        this.name = 'anthropic'
        this.displayName = 'Anthropic Claude'
        this.hostname = config.hostname || 'api.anthropic.com'
        this.apiVersion = config.apiVersion || '2023-06-01'
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        let path = req.path

        // Map OpenAI-style paths to Anthropic paths
        if (path === '/v1/chat/completions') {
            path = '/v1/messages'
        }

        return {
            hostname: this.hostname,
            port: 443,
            path,
            protocol: 'https',
        }
    }

    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        // Anthropic uses x-api-key instead of Authorization Bearer
        let apiKey = headers.authorization
        if (apiKey && apiKey.startsWith('Bearer ')) {
            apiKey = apiKey.slice(7)
        }

        // Also check for x-api-key header directly
        apiKey = headers['x-api-key'] || apiKey

        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': this.apiVersion,
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

        const normalizedUsage: TokenUsage = {
            prompt_tokens: b.usage?.input_tokens || 0,
            completion_tokens: b.usage?.output_tokens || 0,
            total_tokens: (b.usage?.input_tokens || 0) + (b.usage?.output_tokens || 0),
        }

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

    override extractUsage(response: unknown): TokenUsage {
        const r = (response || {}) as { usage?: AnthropicUsage }
        const usage = r.usage || {}
        const input = usage.input_tokens || usage.prompt_tokens || 0
        const output = usage.output_tokens || usage.completion_tokens || 0
        return {
            prompt_tokens: input,
            completion_tokens: output,
            total_tokens: input + output,
        }
    }
}

export default AnthropicProvider
