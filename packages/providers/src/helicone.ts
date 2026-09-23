import { config } from '@llmflow/shared/config'
import { BaseProvider, type ProviderRequest, type ProviderTarget } from './base'

// Headers Helicone reads for its own features; forwarded as sent.
const HELICONE_HEADER_PREFIXES = [
    'helicone-property-',
    'helicone-user-id',
    'helicone-session-id',
    'helicone-session-name',
    'helicone-session-path',
    'helicone-prompt-id',
    'helicone-cache-enabled',
    'helicone-retry-enabled',
    'helicone-rate-limit-policy',
    'helicone-fallbacks',
]

/** Helicone's OpenAI-compatible gateway, for cost tracking. Passthrough only. */
export class HeliconeProvider extends BaseProvider {
    override name = 'helicone'
    override displayName = 'Helicone'

    override passthroughTarget(req: ProviderRequest): ProviderTarget {
        return {
            hostname: config.heliconeHost,
            port: parseInt(config.heliconePort, 10),
            path: req.path,
            protocol: this.protocol,
        }
    }

    override transformRequestHeaders(
        headers: Record<string, string | undefined>,
    ): Record<string, string | undefined> {
        const result = super.transformRequestHeaders(headers)
        const key = headers['helicone-auth'] || config.heliconeApiKey
        if (key) result['Helicone-Auth'] = key.startsWith('Bearer ') ? key : `Bearer ${key}`
        for (const [name, value] of Object.entries(headers))
            if (HELICONE_HEADER_PREFIXES.some((prefix) => name.toLowerCase().startsWith(prefix)))
                result[name] = value
        return result
    }
}
