import type { NextRequest } from 'next/server'
import { parseQuery } from '@/lib/query'
import { createRateLimiter } from '@/lib/rate-limit'
import { searchStream } from '@/lib/search'

// The handler reads the query string, request headers and the abort signal,
// so it always runs at request time (incompatible with cacheComponents config).

export const maxDuration = 60

const rateLimit = createRateLimiter({ limit: 20, windowMs: 60_000 })

const clientKey = (req: NextRequest): string => {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export function GET(req: NextRequest): Response {
  const gate = rateLimit(clientKey(req))
  if (!gate.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(gate.retryAfterMs / 1000)),
      },
    })
  }

  const params = req.nextUrl.searchParams
  const parsed = parseQuery(params.get('kind'), params.get('q'))
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400)
  }

  const stream = searchStream(parsed.query, process.env, req.signal)
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
