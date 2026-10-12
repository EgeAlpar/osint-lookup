import { httpFetch } from '../http'
import type { Finding, Provider, ProviderContext, Query } from '../types'

interface Breach {
  readonly Name?: string
  readonly Title?: string
  readonly BreachDate?: string
  readonly DataClasses?: readonly string[]
}

/** Email -> HaveIBeenPwned breaches. Skips itself when no API key is set. */
export const hibp: Provider = {
  id: 'hibp',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const apiKey = ctx.env.HIBP_API_KEY
    if (apiKey === undefined || apiKey === '') return

    const checkedAt = new Date().toISOString()
    const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(
      query.value,
    )}?truncateResponse=false`
    const response = await ctx.limit(() =>
      httpFetch(url, { signal: ctx.signal, headers: { 'hibp-api-key': apiKey } }),
    )

    if (response.status === 404) {
      yield { provider: this.id, site: 'HaveIBeenPwned', status: 'not-found', checkedAt }
      return
    }
    if (response.status !== 200) {
      yield {
        provider: this.id,
        site: 'HaveIBeenPwned',
        status: 'ambiguous',
        note: `HTTP ${response.status}`,
        checkedAt,
      }
      return
    }

    let breaches: readonly Breach[] = []
    try {
      breaches = JSON.parse(response.body) as readonly Breach[]
    } catch {
      // fall through with empty list
    }

    yield {
      provider: this.id,
      site: 'HaveIBeenPwned',
      status: 'found',
      url: 'https://haveibeenpwned.com/',
      data: {
        count: breaches.length,
        breaches: breaches.map((b) => ({
          name: b.Title ?? b.Name,
          date: b.BreachDate,
          data: b.DataClasses,
        })),
      },
      checkedAt,
    }
  },
}
