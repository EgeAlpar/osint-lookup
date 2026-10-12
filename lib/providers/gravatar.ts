import { httpFetch } from '../http'
import { md5Hex, sha256Hex } from '../hash'
import { safeHttpsUrl } from '../url-safety'
import type { Finding, Provider, ProviderContext, Query } from '../types'

interface GravatarAccount {
  readonly shortname?: string
  readonly url?: string
}

interface GravatarEntry {
  readonly displayName?: string
  readonly preferredUsername?: string
  readonly accounts?: readonly GravatarAccount[]
  readonly thumbnailUrl?: string
}

const toData = (entry: GravatarEntry): Readonly<Record<string, unknown>> => {
  const avatar = safeHttpsUrl(entry.thumbnailUrl)
  return {
    ...(entry.displayName !== undefined && { name: entry.displayName }),
    ...(entry.preferredUsername !== undefined && { username: entry.preferredUsername }),
    ...(avatar !== undefined && { avatar }),
    ...(entry.accounts !== undefined && {
      // Prefer the shortname label; only surface a URL if it is a safe https one.
      linkedAccounts: entry.accounts
        .map((a) => a.shortname ?? safeHttpsUrl(a.url))
        .filter((v): v is string => typeof v === 'string' && v !== ''),
    }),
  }
}

/** Email -> Gravatar public profile (name, username, linked accounts). */
export const gravatar: Provider = {
  id: 'gravatar',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const hash = md5Hex(query.value)
    const profileUrl = `https://gravatar.com/${hash}`
    const checkedAt = new Date().toISOString()
    const response = await ctx.limit(() =>
      httpFetch(`https://en.gravatar.com/${hash}.json`, { signal: ctx.signal }),
    )

    if (response.status === 404) {
      yield { provider: this.id, site: 'Gravatar', status: 'not-found', checkedAt }
      return
    }
    if (response.status !== 200) {
      yield {
        provider: this.id,
        site: 'Gravatar',
        status: 'ambiguous',
        note: `HTTP ${response.status}`,
        checkedAt,
      }
      return
    }

    let entry: GravatarEntry = {}
    try {
      const parsed = JSON.parse(response.body) as { entry?: readonly GravatarEntry[] }
      entry = parsed.entry?.[0] ?? {}
    } catch {
      // Body was not JSON; still a 200, report as found with no detail.
    }

    yield {
      provider: this.id,
      site: 'Gravatar',
      status: 'found',
      url: profileUrl,
      data: { ...toData(entry), sha256: sha256Hex(query.value) },
      checkedAt,
    }
  },
}
