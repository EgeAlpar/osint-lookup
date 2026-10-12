import { mergeAsync } from './merge'
import type { Finding, Provider, ProviderContext, Query } from './types'

export const providersFor = (providers: readonly Provider[], query: Query): readonly Provider[] =>
  providers.filter((p) => p.kind === 'both' || p.kind === query.kind)

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error'

/** Run a provider, converting a crash into a single error finding. */
async function* guarded(provider: Provider, query: Query, ctx: ProviderContext) {
  try {
    yield* provider.run(query, ctx)
  } catch (error) {
    yield {
      provider: provider.id,
      site: provider.id,
      status: 'error',
      note: errorMessage(error),
      checkedAt: new Date().toISOString(),
    } satisfies Finding
  }
}

/** Fan out to every matching provider and stream deduplicated findings. */
export async function* aggregate(
  providers: readonly Provider[],
  query: Query,
  ctx: ProviderContext,
): AsyncIterable<Finding> {
  const sources = providersFor(providers, query).map((p) => guarded(p, query, ctx))
  const seen = new Set<string>()

  for await (const finding of mergeAsync(sources)) {
    const key = `${finding.provider}\u0000${finding.site}`
    if (seen.has(key)) continue
    seen.add(key)
    yield finding
  }
}
