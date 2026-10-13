import { classify } from '../classify'
import { extractData } from '../extract'
import { httpFetch } from '../http'
import type { SiteDef } from '../manifest'
import { fillUrl } from '../template'
import type { Finding, FindingStatus, ProviderContext } from '../types'

const PROBE_TIMEOUT_MS = 6000

// Bot-protection interstitials (Cloudflare etc.) answer 200 with a challenge
// page. A bare 200 would then look like a real profile, so when these markers
// appear we never claim "found" - the check is inconclusive.
const CHALLENGE_MARKERS = [
  'Just a moment...',
  'Client Challenge',
  'cf-browser-verification',
  'cf_chl_',
  'Checking your browser',
  'Attention Required! | Cloudflare',
  'Enable JavaScript and cookies to continue',
] as const

const looksLikeChallenge = (body: string): boolean =>
  CHALLENGE_MARKERS.some((marker) => body.includes(marker))

/**
 * Check `value` against every site in a manifest, one request each under the
 * shared concurrency limit. Shared by the username and email-handle providers.
 * A `found` verdict on a bot-challenge body is downgraded to `ambiguous` so a
 * reported profile link always points at a real page. When a site declares an
 * `extract` map, matching fields from its JSON response enrich the finding.
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
        let status: FindingStatus = classify(response, site.rules)
        let challengeNote: string | undefined
        if (status === 'found' && looksLikeChallenge(response.body)) {
          status = 'ambiguous'
          challengeNote = 'blocked by bot protection; could not verify'
        }
        const data =
          status === 'found' && site.extract !== undefined
            ? extractData(response.body, site.extract)
            : undefined
        return {
          provider: providerId,
          site: site.name,
          status,
          url: profileUrl,
          ...(data !== undefined && { data }),
          ...(challengeNote !== undefined
            ? { note: challengeNote }
            : note !== undefined && { note }),
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
