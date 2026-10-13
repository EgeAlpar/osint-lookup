/** Read a dotted path (e.g. "data.total_karma") out of a parsed JSON value. */
function readPath(root: unknown, path: string): unknown {
  let current: unknown = root
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Pull the fields named in `map` out of a JSON response body. Returns a new
 * object with only the labels whose value is a non-empty primitive, so empty
 * API fields don't clutter the finding. Never throws on bad JSON.
 */
export function extractData(
  body: string,
  map: Readonly<Record<string, string>>,
): Readonly<Record<string, unknown>> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return undefined
  }
  const out: Record<string, unknown> = {}
  for (const [label, path] of Object.entries(map)) {
    const value = readPath(parsed, path)
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'object') continue
    out[label] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}
