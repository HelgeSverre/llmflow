import { config } from '@llmflow/shared/config'
import {
    BaseProvider,
    type NormalizedResponse,
    type ProviderRequest,
    type ProviderTarget,
    type TokenUsage,
    type UsageLike,
} from './base'

export interface AzureOpenAIProviderConfig {
    resource?: string
    apiVersion?: string
    deploymentMap?: Record<string, string>
}

/**
 * Azure OpenAI provider.
 *
 * Key differences from OpenAI:
 * - Endpoint: https://{resource}.openai.azure.com/openai/deployments/{deployment}/{endpoint}?api-version={version}
 * - Uses api-key header instead of Authorization Bearer
 * - Model name in request is mapped to deployment name in URL
 * - api-version query parameter is required
 * - Request/response format is same as OpenAI
 */
export class AzureOpenAIProvider extends BaseProvider {
    resource: string | undefined
    apiVersion: string
    deploymentMap: Record<string, string>

    constructor(options: AzureOpenAIProviderConfig = {}) {
        super()
        this.name = 'azure'
        this.displayName = 'Azure OpenAI'

        this.resource = options.resource || config.azureResource
        this.apiVersion = options.apiVersion || config.azureApiVersion
        this.deploymentMap = options.deploymentMap || {}
    }

    /**
     * Map OpenAI model name to Azure deployment name.
     * Azure deployments often have dots removed (gpt-3.5-turbo -> gpt-35-turbo).
     */
    getDeploymentName(model: string): string {
        if (this.deploymentMap[model]) {
            return this.deploymentMap[model]
        }

        const configured = config.azureDeployment(model)
        if (configured) return configured

        // Default: use model name as deployment (common pattern)
        // Also try removing dots (gpt-3.5-turbo -> gpt-35-turbo)
        return model.replace(/\./g, '')
    }

    /**
     * Extract Azure resource name from headers or use configured default.
     */
    getResourceName(headers: Record<string, string | undefined> | undefined): string {
        const headerResource =
            headers?.['x-azure-resource'] || headers?.['x-llmflow-azure-resource']
        if (headerResource) return headerResource

        if (this.resource) return this.resource

        return config.azureResource || 'azure-openai'
    }

    override getTarget(req: ProviderRequest): ProviderTarget {
        const reqBody = (req.body || {}) as { model?: string }
        const model = reqBody.model || 'gpt-4'
        const deployment = this.getDeploymentName(model)
        const resource = this.getResourceName(req.headers)

        let endpoint = req.path
        if (endpoint.startsWith('/v1/')) {
            endpoint = endpoint.slice(3) // Remove /v1 prefix
        }

        const path = `/openai/deployments/${deployment}${endpoint}?api-version=${this.apiVersion}`

        return {
            hostname: `${resource}.openai.azure.com`,
            port: 443,
            path,
            protocol: 'https',
        }
    }

    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
        _req: ProviderRequest,
    ): Record<string, string | undefined> {
        let apiKey = headers?.authorization
        if (apiKey && apiKey.startsWith('Bearer ')) {
            apiKey = apiKey.slice(7)
        }

        apiKey = headers?.['api-key'] || apiKey

        return {
            'Content-Type': 'application/json',
            'api-key': apiKey,
        }
    }

    override transformRequestBody(body: unknown, _req: ProviderRequest): unknown {
        return body
    }

    override normalizeResponse(body: unknown, req: ProviderRequest): NormalizedResponse {
        const reqBody = (req.body || {}) as Record<string, unknown>
        const b = body as
            | {
                  model?: string
                  usage?: TokenUsage
                  error?: unknown
              }
            | null
            | undefined

        if (!b || b.error) {
            return { data: body, usage: null, model: reqBody.model as string | undefined }
        }

        return {
            data: body,
            usage: b.usage || null,
            model: b.model || (reqBody.model as string | undefined) || 'unknown',
        }
    }

    override extractUsage(response: unknown): TokenUsage {
        const r = (response || {}) as { usage?: UsageLike }
        const usage = r.usage || {}
        return {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens:
                usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
        }
    }
}
