const USERNAME_PATTERN = /^[A-Za-z0-9._-]{2,64}$/

/**
 * Derive a candidate username from an email's local part: the text before `@`,
 * with any `+tag` suffix dropped. Returns null when the result is not a usable
 * handle (too short, or has characters a username manifest would never match).
 * A match is a lead, not proof the handle belongs to the email owner.
 */
export function candidateUsername(email: string): string | null {
  const at = email.indexOf('@')
  const localRaw = at === -1 ? email : email.slice(0, at)
  const local = localRaw.split('+')[0]?.trim() ?? ''
  return USERNAME_PATTERN.test(local) ? local : null
}
