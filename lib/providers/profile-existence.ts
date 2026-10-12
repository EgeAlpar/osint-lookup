import sitesManifest from '../data/sites.json'
import { parseSites } from '../manifest'
import type { Finding, Provider, ProviderContext, Query } from '../types'
import { runSiteChecks } from './site-check'

const sites = parseSites(sitesManifest)

/** Username -> which public profile pages exist (Sherlock-style). */
export const profileExistence: Provider = {
  id: 'profile-existence',
  kind: 'username',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    for (const finding of await Promise.all(runSiteChecks(this.id, sites, query.value, ctx))) {
      yield finding
    }
  },
}
