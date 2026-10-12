import { describe, expect, it } from 'vitest'
import { candidateUsername } from '@/lib/email-username'

describe('candidateUsername', () => {
  it('takes the local part before @', () => {
    expect(candidateUsername('egealpar09@gmail.com')).toBe('egealpar09')
  })

  it('drops a +tag suffix', () => {
    expect(candidateUsername('john.doe+shopping@example.com')).toBe('john.doe')
  })

  it('accepts a bare handle with no @', () => {
    expect(candidateUsername('octocat')).toBe('octocat')
  })

  it('returns null when the local part is too short or malformed', () => {
    expect(candidateUsername('a@x.co')).toBeNull()
    expect(candidateUsername('a b@x.co')).toBeNull()
    expect(candidateUsername('+tagonly@x.co')).toBeNull()
  })
})
