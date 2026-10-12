export type QueryKind = 'email' | 'username'

export interface Query {
  readonly kind: QueryKind
  readonly value: string
}

export type FindingStatus = 'found' | 'not-found' | 'ambiguous' | 'error'

export interface Finding {
  readonly provider: string
  readonly site: string
  readonly status: FindingStatus
  readonly url?: string
  readonly data?: Readonly<Record<string, unknown>>
  readonly note?: string
  readonly checkedAt: string
}

export type Limit = <T>(task: () => Promise<T>) => Promise<T>

export type Env = Readonly<Record<string, string | undefined>>

export interface ProviderContext {
  readonly signal: AbortSignal
  readonly limit: Limit
  readonly env: Env
}

export interface Provider {
  readonly id: string
  readonly kind: QueryKind | 'both'
  run(query: Query, ctx: ProviderContext): AsyncIterable<Finding>
}

export type StreamEvent =
  | { readonly type: 'start'; readonly query: Query; readonly providers: readonly string[] }
  | { readonly type: 'finding'; readonly finding: Finding }
  | { readonly type: 'done'; readonly count: number }
  | { readonly type: 'error'; readonly message: string }
