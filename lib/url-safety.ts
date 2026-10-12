/**
 * Guards against SSRF and dangerous URL schemes. Used both to validate redirect
 * hops in the fetch wrapper and to scheme-check URLs that come back from
 * third-party responses before they are emitted to the client.
 */

const stripBrackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

const isPrivateIpv4 = (host: string): boolean => {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => Number(p))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

const isPrivateIpv6 = (host: string): boolean => {
  const h = host.toLowerCase()
  return (
    h === '::' ||
    h === '::1' ||
    h.startsWith('fe80:') || // link-local
    h.startsWith('fc') || // unique local fc00::/7
    h.startsWith('fd')
  )
}

/** True for loopback, link-local, private, and cloud-metadata hosts. */
export function isPrivateHostname(hostname: string): boolean {
  const host = stripBrackets(hostname.trim().toLowerCase())
  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local')) return true
  if (host.includes(':')) return isPrivateIpv6(host)
  return isPrivateIpv4(host)
}

/** Throw unless `url` is an https URL pointing at a public host. */
export function assertPublicHttps(url: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error(`Refusing non-https target: ${parsed.protocol}`)
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error(`Refusing request to private host: ${parsed.hostname}`)
  }
  return parsed
}

/**
 * Return the url only if it is a safe https public url; otherwise undefined.
 * Use before echoing a URL that came from a third party to the client, so a
 * `javascript:`/`data:`/internal URL can never reach the UI.
 */
export function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    assertPublicHttps(value)
    return value
  } catch {
    return undefined
  }
}
