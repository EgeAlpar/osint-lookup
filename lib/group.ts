import type { Finding } from './types'

export interface FindingGroups {
  readonly found: readonly Finding[]
  readonly notFound: readonly Finding[]
  readonly uncertain: readonly Finding[]
}

const bySite = (a: Finding, b: Finding) => a.site.localeCompare(b.site)

export function groupFindings(findings: readonly Finding[]): FindingGroups {
  const pick = (predicate: (f: Finding) => boolean) => findings.filter(predicate).sort(bySite)
  return {
    found: pick((f) => f.status === 'found'),
    notFound: pick((f) => f.status === 'not-found'),
    uncertain: pick((f) => f.status === 'ambiguous' || f.status === 'error'),
  }
}
