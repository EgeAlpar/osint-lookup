import { assertPublicHttps } from './url-safety'

export const USER_AGENT =
  'osint-lookup/0.1 (+https://github.com/; aggregator for authorized lookups)'

export interface FetchOptions {
  readonly signal: AbortSignal
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string
  /** Per-request timeout in ms. Default 8000. */
  readonly timeoutMs?: number
  /** Retries on a thrown network/timeout error. Default 1. */
  readonly retries?: number
  /** Cap the body we read, to avoid huge responses. Default 256 KiB. */
  readonly maxBytes?: number
}

export interface HttpResponse {
  readonly status: number
  readonly body: string
  readonly finalUrl: string
}

const DEFAULT_TIMEOUT = 8000
const DEFAULT_MAX_BYTES = 256 * 1024
const MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (reader === undefined) return ''
  const decoder = new TextDecoder()
  let out = ''
  while (out.length < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  await reader.cancel().catch(() => {})
  return out.length > maxBytes ? out.slice(0, maxBytes) : out
}

/** fetch with timeout, bounded body, and a retry on transient failure. */
export async function httpFetch(url: string, options: FetchOptions): Promise<HttpResponse> {
  const {
    signal,
    method = 'GET',
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = 1,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const timeout = new AbortController()
    const onAbort = () => timeout.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => timeout.abort(), timeoutMs)
    try {
      // Follow redirects by hand so each hop can be re-validated against the
      // SSRF guard; the browser `redirect: 'follow'` would skip those checks.
      let currentUrl = assertPublicHttps(url).toString()
      let currentMethod = method
      let currentBody = body
      for (let hop = 0; ; hop += 1) {
        const response = await fetch(currentUrl, {
          method: currentMethod,
          headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
          body: currentBody,
          redirect: 'manual',
          signal: timeout.signal,
        })

        const location = response.headers.get('location')
        if (REDIRECT_STATUSES.has(response.status) && location !== null) {
          if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects')
          currentUrl = assertPublicHttps(new URL(location, currentUrl).toString()).toString()
          // 303, and 301/302 by convention, downgrade to a bodyless GET.
          if (response.status !== 307 && response.status !== 308) {
            currentMethod = 'GET'
            currentBody = undefined
          }
          await response.body?.cancel().catch(() => {})
          continue
        }

        const text = await readCapped(response, maxBytes)
        return { status: response.status, body: text, finalUrl: currentUrl }
      }
    } catch (error) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      lastError = error
      if (attempt < retries) await sleep(250 * (attempt + 1), signal)
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed')
}
