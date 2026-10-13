import { httpFetch } from '../http'
import type { Finding, FindingStatus, Provider, ProviderContext, Query } from '../types'

interface KickboxResult {
  readonly result?: string // deliverable | undeliverable | risky | unknown
  readonly reason?: string
  readonly disposable?: boolean
  readonly role?: boolean
  readonly free?: boolean
  readonly accept_all?: boolean
  readonly did_you_mean?: string | null
  readonly sendex?: number
  readonly success?: boolean
}

const STATUS: Record<string, FindingStatus> = {
  deliverable: 'found',
  undeliverable: 'not-found',
  risky: 'ambiguous',
  unknown: 'ambiguous',
}

/** Email -> deliverability and quality via Kickbox's keyless open endpoint. */
export const kickbox: Provider = {
  id: 'kickbox',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const checkedAt = new Date().toISOString()
    const url = `https://open.kickbox.com/v1/${encodeURIComponent(query.value)}`
    const response = await ctx.limit(() => httpFetch(url, { signal: ctx.signal }))
    if (response.status !== 200) {
      yield { provider: this.id, site: 'Email quality (Kickbox)', status: 'ambiguous', note: `HTTP ${response.status}`, checkedAt }
      return
    }

    let parsed: KickboxResult = {}
    try {
      parsed = JSON.parse(response.body) as KickboxResult
    } catch {
      // fall through with empty result
    }

    yield {
      provider: this.id,
      site: 'Email quality (Kickbox)',
      status: STATUS[parsed.result ?? 'unknown'] ?? 'ambiguous',
      data: {
        ...(parsed.result !== undefined && { result: parsed.result }),
        ...(parsed.reason !== undefined && { reason: parsed.reason }),
        ...(parsed.disposable !== undefined && { disposable: parsed.disposable }),
        ...(parsed.role !== undefined && { role: parsed.role }),
        ...(parsed.free !== undefined && { freeProvider: parsed.free }),
        ...(parsed.accept_all !== undefined && { acceptAll: parsed.accept_all }),
        ...(parsed.did_you_mean ? { didYouMean: parsed.did_you_mean } : {}),
        ...(parsed.sendex !== undefined && { qualityScore: parsed.sendex }),
      },
      checkedAt,
    }
  },
}
