import { httpFetch } from '../http'
import { safeHttpsUrl } from '../url-safety'
import type { Finding, Provider, ProviderContext, Query } from '../types'

interface GitHubUser {
  readonly login?: string
  readonly html_url?: string
}

/** Email -> GitHub user whose public commits use that address. */
export const githubEmail: Provider = {
  id: 'github-email',
  kind: 'email',
  async *run(query: Query, ctx: ProviderContext): AsyncIterable<Finding> {
    const token = ctx.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token !== undefined && token !== '') headers.Authorization = `Bearer ${token}`

    const checkedAt = new Date().toISOString()
    const url = `https://api.github.com/search/users?q=${encodeURIComponent(
      `${query.value} in:email`,
    )}`
    const response = await ctx.limit(() => httpFetch(url, { signal: ctx.signal, headers }))

    if (response.status === 403 || response.status === 429) {
      yield {
        provider: this.id,
        site: 'GitHub',
        status: 'ambiguous',
        note: 'rate limited (set GITHUB_TOKEN)',
        checkedAt,
      }
      return
    }
    if (response.status !== 200) {
      yield {
        provider: this.id,
        site: 'GitHub',
        status: 'ambiguous',
        note: `HTTP ${response.status}`,
        checkedAt,
      }
      return
    }

    let items: readonly GitHubUser[] = []
    try {
      items = (JSON.parse(response.body) as { items?: readonly GitHubUser[] }).items ?? []
    } catch {
      // fall through
    }

    if (items.length === 0) {
      yield { provider: this.id, site: 'GitHub', status: 'not-found', checkedAt }
      return
    }

    const top = items[0]
    const profileUrl = safeHttpsUrl(top.html_url)
    yield {
      provider: this.id,
      site: 'GitHub',
      status: 'found',
      ...(profileUrl !== undefined && { url: profileUrl }),
      data: {
        matches: items.length,
        logins: items.slice(0, 5).map((u) => u.login).filter(Boolean),
      },
      checkedAt,
    }
  },
}
