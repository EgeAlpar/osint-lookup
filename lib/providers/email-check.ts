import { httpFetch } from '../http'
import type { Finding, FindingStatus, Provider, ProviderContext, Query } from '../types'

interface DisifyResult {
  readonly format?: boolean
  readonly domain?: string
  readonly disposable?: boolean
  readonly dns?: boolean
  readonly whitelist?: boolean
}

const verdict = (r: DisifyResult): FindingStatus => {
  if (r.format === false || r.dns === false) return 'not-found'
  if (r.disposable === true) return 'ambiguous'
  return 'found'
}

/** Email -> validity and quality (format, DNS, disposable) via Disify (keyless). */
export const emailCheck: Provider = {
  id: 'email-check',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const checkedAt = new Date().toISOString()
    const url = `https://www.disify.com/api/email/${encodeURIComponent(query.value)}`
    const response = await ctx.limit(() => httpFetch(url, { signal: ctx.signal }))
    if (response.status !== 200) {
      yield { provider: this.id, site: 'Email validity (Disify)', status: 'ambiguous', note: `HTTP ${response.status}`, checkedAt }
      return
    }

    let r: DisifyResult = {}
    try {
      r = JSON.parse(response.body) as DisifyResult
    } catch {
      yield { provider: this.id, site: 'Email validity (Disify)', status: 'ambiguous', note: 'unparseable response', checkedAt }
      return
    }

    yield {
      provider: this.id,
      site: 'Email validity (Disify)',
      status: verdict(r),
      data: {
        ...(r.domain !== undefined && { domain: r.domain }),
        ...(r.format !== undefined && { validFormat: r.format }),
        ...(r.dns !== undefined && { domainHasDns: r.dns }),
        ...(r.disposable !== undefined && { disposable: r.disposable }),
        ...(r.whitelist !== undefined && { knownProvider: r.whitelist }),
      },
      checkedAt,
    }
  },
}
