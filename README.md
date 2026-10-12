# OSINT Lookup

A small aggregator that takes a single **email** or **username** and, in parallel,
queries many public sources to show where that identity leaves a footprint.
Results stream into the UI as each source answers, each tagged with the provider
it came from and a link to the raw source.

This is a personal / learning project. It is an **aggregator** — it produces no
data of its own; it only brings public sources and official APIs together in one
place.

## Usage note (design constraint, not just policy)

This tool is meant for **your own accounts, identities that have given you
permission, and non-personal targets** (domains, organisations, infrastructure).
Results are **not stored** (aside from the optional short-lived in-memory cache).
That is a deliberate part of the architecture: no result persistence, no identity
profiles kept in a database.

## Stack

- Next.js (App Router) + TypeScript, single project (UI + API routes).
- Node 24, ESM, npm.
- Vitest for the pure logic (classifier, hashing, normalisation, aggregation).
- Native `fetch` + `AbortController`; a tiny hand-written concurrency limiter.
  No runtime HTTP dependencies.

## How it works

1. The UI posts the input to `GET /api/search?kind=email|username&q=...`.
2. The route validates the input, then selects the providers whose `kind`
   matches the query.
3. `lib/aggregate.ts` fans out to every matching provider under a concurrency
   limit (10) and streams each `Finding` as newline-delimited JSON (NDJSON) as
   soon as it is ready.
4. An `AbortController` lets the user cancel; every request also has its own
   timeout.

Findings are grouped in the UI: **found** first, then **uncertain / errors**,
then **not found**.

## Providers

| Provider | Input | Needs a key? | What it reports |
|----------|-------|--------------|-----------------|
| `profile-existence` | username | no | Which of ~25 public sites have a profile at that handle (data-driven via `lib/data/sites.json`). |
| `gravatar` | email | no | Gravatar public profile: name, username, linked accounts, avatar. |
| `hibp` | email | `HIBP_API_KEY` | HaveIBeenPwned breaches (name, date, leaked data classes). Skips itself with no key. |
| `github-email` | email | `GITHUB_TOKEN` (optional) | GitHub users whose public commits use that address. Works keyless at a lower rate limit. |
| `account-existence` | email / username | no | Whether an address/handle is registered on a service, inferred from its signup / status endpoint (holehe-style), data-driven via `lib/data/account-sites.json`. |

Every provider that needs a key **skips itself silently** when the key is
missing — the app still runs with whatever is configured.

## Running

```bash
npm install
cp .env.local.example .env.local   # optional; fill in any keys you have
npm run dev                         # http://localhost:3000
```

### Verify

1. Search your **own** username — your known profiles should show as `found`.
2. Search your **own** email — Gravatar (if any), HIBP (with a key), and a
   GitHub commit-email match should appear.
3. Hit **Cancel** mid-search — the stream stops (AbortController).
4. Run with no keys — keyed providers are skipped silently, no errors.

## Environment variables (`.env.local`)

```
HIBP_API_KEY=
HUNTER_API_KEY=
GITHUB_TOKEN=
```

All optional. A missing key only disables that one provider.

## Scripts

```bash
npm test            # vitest run
npm run test:coverage
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
```

## Extending the site lists

Both `lib/data/sites.json` (public-profile checks) and
`lib/data/account-sites.json` (account-existence checks) are plain manifests
validated at load by `lib/manifest.ts`. Add an entry — `{q}` is the query
placeholder — and it is picked up automatically. Classification rules
(`foundText`, `notFoundText`, status codes, etc.) are documented on
`ExistRules` in `lib/classify.ts`.

## Design / quality notes

- Pure functions are tested first; network providers are tested with a mocked
  `fetch` (no requests go to real services in the test suite).
- Input is validated and normalised (`lib/query.ts`); URL templates are
  restricted to `https` with the placeholder outside the host, and user input
  is percent-encoded into URLs and inserted into parsed JSON (never raw text),
  to avoid request-shape injection and SSRF via the manifest.
- Outbound requests follow redirects manually and re-validate every hop
  (`lib/url-safety.ts`): https only, and private / loopback / link-local /
  cloud-metadata hosts are refused, so a redirect cannot be used to reach
  internal infrastructure (SSRF). URLs that come back from third parties
  (Gravatar avatar / linked accounts, GitHub profile) are https-scheme-checked
  before being emitted, so a `javascript:` / `data:` URL can never reach the UI.
- The API route is rate-limited per client (20 requests / minute) and returns
  `Retry-After`. Note: the limiter is in-memory per process and keys off
  `X-Forwarded-For`, so for a real multi-instance deployment behind a proxy you
  would move it to a shared store (e.g. Redis) and derive the client IP from a
  trusted hop. Fine for local / single-instance use.
- Immutable data throughout; small, single-purpose files.
