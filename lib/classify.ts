import type { FindingStatus } from './types'

export interface ExistRules {
  /** Statuses that mean the account exists. Default: [200]. */
  readonly foundStatus?: readonly number[]
  /** Statuses that mean the account does not exist. Default: [404, 410]. */
  readonly notFoundStatus?: readonly number[]
  /** Body markers that mean "no such account". Checked before found markers. */
  readonly notFoundText?: readonly string[]
  /** If set, a found status also needs one of these markers in the body. */
  readonly foundText?: readonly string[]
  /** A redirect landing on a url containing this means "no such account". */
  readonly notFoundUrl?: string
  /** Read body markers regardless of status (APIs that answer 4xx with a verdict). */
  readonly matchAnyStatus?: boolean
}

export interface ProbeResult {
  readonly status: number
  readonly body: string
  readonly finalUrl: string
}

const DEFAULT_FOUND = [200] as const
const DEFAULT_NOT_FOUND = [404, 410] as const

const containsAny = (body: string, markers: readonly string[] | undefined): boolean =>
  markers !== undefined && markers.some((marker) => body.includes(marker))

export function classify(result: ProbeResult, rules: ExistRules): FindingStatus {
  const foundStatus = rules.foundStatus ?? DEFAULT_FOUND
  const notFoundStatus = rules.notFoundStatus ?? DEFAULT_NOT_FOUND

  if (notFoundStatus.includes(result.status)) return 'not-found'
  if (rules.notFoundUrl !== undefined && result.finalUrl.includes(rules.notFoundUrl)) {
    return 'not-found'
  }

  const statusMatches = foundStatus.includes(result.status)
  if (!statusMatches && !rules.matchAnyStatus) return 'ambiguous'

  if (containsAny(result.body, rules.notFoundText)) return 'not-found'
  if (rules.foundText !== undefined) {
    return containsAny(result.body, rules.foundText) ? 'found' : 'ambiguous'
  }
  return statusMatches ? 'found' : 'ambiguous'
}
