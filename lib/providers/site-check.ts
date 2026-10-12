import { classify } from '../classify'
import { httpFetch } from '../http'
import type { SiteDef } from '../manifest'
import { fillUrl } from '../template'
import type { Finding, ProviderContext } from '../types'

const PROBE_TIMEOUT_MS = 6000

/**
 * Check `value` against every site in a manifest, one request each under the
 * shared concurrency limit. Shared by the username and email-handle providers.
 */
export function runSiteChecks(
  providerId: string,
  sites: readonly SiteDef[],
  value: string,
  ctx: ProviderContext,
  note?: string,
): Promise<Finding>[] {
  return sites.map((site) =>
    ctx.limit(async (): Promise<Finding> => {
      const checkedAt = new Date().toISOString()
      const profileUrl = fillUrl(site.urlTemplate, value)
      const probeUrl = fillUrl(site.probeTemplate ?? site.urlTemplate, value)
      try {
        const response = await httpFetch(probeUrl, { signal: ctx.signal, timeoutMs: PROBE_TIMEOUT_MS })
        return {
          provider: providerId,
          site: site.name,
          status: classify(response, site.rules),
          url: profileUrl,
          ...(note !== undefined && { note }),
          checkedAt,
        }
      } catch (error) {
        if (ctx.signal.aborted) throw error
        return {
          provider: providerId,
          site: site.name,
          status: 'error',
          url: profileUrl,
          note: error instanceof Error ? error.message : 'request failed',
          checkedAt,
        }
      }
    }),
  )
}
