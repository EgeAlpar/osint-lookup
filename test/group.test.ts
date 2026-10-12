import { describe, expect, it } from 'vitest'
import { groupFindings } from '@/lib/group'
import type { Finding } from '@/lib/types'

const f = (site: string, status: Finding['status']): Finding => ({
  provider: 'p',
  site,
  status,
  checkedAt: '2026-01-01T00:00:00.000Z',
})

describe('groupFindings', () => {
  it('splits by status and sorts each group by site name', () => {
    const groups = groupFindings([
      f('Zeta', 'found'),
      f('Alpha', 'found'),
      f('Beta', 'not-found'),
      f('Gamma', 'ambiguous'),
      f('Delta', 'error'),
    ])
    expect(groups.found.map((x) => x.site)).toEqual(['Alpha', 'Zeta'])
    expect(groups.notFound.map((x) => x.site)).toEqual(['Beta'])
    expect(groups.uncertain.map((x) => x.site)).toEqual(['Delta', 'Gamma'])
  })

  it('does not mutate the input', () => {
    const input = Object.freeze([f('B', 'found'), f('A', 'found')])
    expect(() => groupFindings(input)).not.toThrow()
    expect(input.map((x) => x.site)).toEqual(['B', 'A'])
  })
})
