import { classify } from '../classify'
import { httpFetch } from '../http'
import { parseSites } from '../manifest'
import sitesManifest from '../data/sites.json'
import { fillUrl } from '../template'
import type { Finding, Provider, ProviderContext, Query } from '../types'

const sites = parseSites(sitesManifest)

/** Username -> which public profile pages exist (Sherlock-style). */
export const profileExistence: Provider = {
  id: 'profile-existence',
  kind: 'username',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const findings = sites.map((site) =>
      ctx.limit(async (): Promise<Finding> => {
        const checkedAt = new Date().toISOString()
        const profileUrl = fillUrl(site.urlTemplate, query.value)
        const probeUrl = fillUrl(site.probeTemplate ?? site.urlTemplate, query.value)
        try {
          const response = await httpFetch(probeUrl, { signal: ctx.signal })
          return {
            provider: this.id,
            site: site.name,
            status: classify(response, site.rules),
            url: profileUrl,
            checkedAt,
          }
        } catch (error) {
          if (ctx.signal.aborted) throw error
          return {
            provider: this.id,
            site: site.name,
            status: 'error',
            url: profileUrl,
            note: error instanceof Error ? error.message : 'request failed',
            checkedAt,
          }
        }
      }),
    )
    for (const finding of await Promise.all(findings)) yield finding
  },
}
