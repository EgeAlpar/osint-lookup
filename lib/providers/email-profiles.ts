import sitesManifest from '../data/sites.json'
import { candidateUsername } from '../email-username'
import { parseSites } from '../manifest'
import type { Finding, Provider, ProviderContext, Query } from '../types'
import { runSiteChecks } from './site-check'

const sites = parseSites(sitesManifest)

/**
 * Email -> treat the local part as a candidate username and scan the same
 * profile sites, so an email search also surfaces real profile links. Each
 * finding is noted as a candidate, since the handle may not be the same person.
 */
export const emailProfiles: Provider = {
  id: 'email-profiles',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const handle = candidateUsername(query.value)
    if (handle === null) return
    const note = `candidate handle "${handle}" derived from email local-part`
    for (const finding of await Promise.all(runSiteChecks(this.id, sites, handle, ctx, note))) {
      yield finding
    }
  },
}
