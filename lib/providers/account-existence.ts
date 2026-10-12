import { classify } from '../classify'
import { httpFetch } from '../http'
import { parseAccountSites } from '../manifest'
import accountManifest from '../data/account-sites.json'
import { fillDeep, fillUrl } from '../template'
import type { Finding, Provider, ProviderContext, Query } from '../types'

const accountSites = parseAccountSites(accountManifest)

/** email/username -> is it registered on a service (holehe-style). */
export const accountExistence: Provider = {
  id: 'account-existence',
  kind: 'both',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const matching = accountSites.filter((site) => site.kind === query.kind)
    const findings = matching.map((site) =>
      ctx.limit(async (): Promise<Finding> => {
        const checkedAt = new Date().toISOString()
        try {
          const url = fillUrl(site.urlTemplate, query.value)
          const body =
            site.body === undefined ? undefined : JSON.stringify(fillDeep(site.body, query.value))
          const response = await httpFetch(url, {
            signal: ctx.signal,
            method: site.method,
            ...(site.headers !== undefined && { headers: site.headers }),
            ...(body !== undefined && { body }),
          })
          return {
            provider: this.id,
            site: site.name,
            status: classify(response, site.rules),
            ...(site.displayUrl !== undefined && { url: site.displayUrl }),
            checkedAt,
          }
        } catch (error) {
          if (ctx.signal.aborted) throw error
          return {
            provider: this.id,
            site: site.name,
            status: 'error',
            ...(site.displayUrl !== undefined && { url: site.displayUrl }),
            note: error instanceof Error ? error.message : 'request failed',
            checkedAt,
          }
        }
      }),
    )
    for (const finding of await Promise.all(findings)) yield finding
  },
}
