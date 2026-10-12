import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpFetch } from '@/lib/http'

const live = new AbortController().signal

afterEach(() => {
  vi.restoreAllMocks()
})

describe('httpFetch', () => {
  it('returns status, body and a final url, sending a User-Agent', async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      new Response('hello', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpFetch('https://x.test/a', { signal: live })
    expect(result).toMatchObject({ status: 200, body: 'hello', finalUrl: 'https://x.test/a' })
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['User-Agent']).toContain('osint-lookup')
  })

  it('retries once on a thrown error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpFetch('https://x.test', { signal: live, retries: 1 })
    expect(result.body).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting retries', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpFetch('https://x.test', { signal: live, retries: 1 })).rejects.toThrow('down')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caps the body it reads', async () => {
    const big = 'x'.repeat(10_000)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(big, { status: 200 })))

    const result = await httpFetch('https://x.test', { signal: live, maxBytes: 100 })
    expect(result.body.length).toBeLessThanOrEqual(100)
  })

  it('does not retry once the caller aborts', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(async () => {
      controller.abort()
      throw new Error('boom')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      httpFetch('https://x.test', { signal: controller.signal, retries: 3 }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('follows a redirect to a public https host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: 'https://y.test/final' } }),
      )
      .mockResolvedValueOnce(new Response('landed', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpFetch('https://x.test/start', { signal: live, retries: 0 })
    expect(result).toMatchObject({ status: 200, body: 'landed', finalUrl: 'https://y.test/final' })
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://y.test/final')
  })

  it('refuses a redirect to a private/internal host (SSRF guard)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpFetch('https://x.test', { signal: live, retries: 0 })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses a non-https or private initial url before fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(httpFetch('http://x.test', { signal: live, retries: 0 })).rejects.toThrow()
    await expect(
      httpFetch('https://127.0.0.1/x', { signal: live, retries: 0 }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws immediately when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpFetch('https://x.test', { signal: controller.signal })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
