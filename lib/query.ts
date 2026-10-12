import { normalizeEmail } from './hash'
import type { Query, QueryKind } from './types'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
// Dot is excluded from the local and label classes, so the inner and outer
// quantifiers cannot overlap -> no catastrophic backtracking. Control
// characters and URL-structural characters (/ : # ? @ whitespace) are excluded
// so the value cannot alter the shape of a request it is interpolated into.
const EMAIL_LOCAL = "[^\\s@/:#?\\x00-\\x1f\\x7f]+"
const EMAIL_LABEL = '[^\\s@./:#?\\x00-\\x1f\\x7f]+'
const EMAIL_PATTERN = new RegExp(`^${EMAIL_LOCAL}@${EMAIL_LABEL}(\\.${EMAIL_LABEL})+$`)
const EMAIL_MAX_LENGTH = 254

export type ParseResult =
  | { readonly ok: true; readonly query: Query }
  | { readonly ok: false; readonly error: string }

export const detectKind = (value: string): QueryKind => (value.includes('@') ? 'email' : 'username')

const resolveKind = (raw: string | null, value: string): QueryKind | null => {
  if (raw === null || raw === '' || raw === 'auto') return detectKind(value)
  if (raw === 'email' || raw === 'username') return raw
  return null
}

export function parseQuery(kindRaw: string | null, valueRaw: string | null): ParseResult {
  const trimmed = (valueRaw ?? '').trim()
  if (trimmed === '') return { ok: false, error: 'Query is empty' }

  const kind = resolveKind(kindRaw, trimmed)
  if (kind === null) return { ok: false, error: 'Unknown query kind' }

  if (kind === 'email') {
    const email = normalizeEmail(trimmed)
    if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
      return { ok: false, error: 'Invalid email address' }
    }
    return { ok: true, query: { kind, value: email } }
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Username may only contain letters, digits, ".", "_" and "-" (max 64)' }
  }
  return { ok: true, query: { kind, value: trimmed } }
}
