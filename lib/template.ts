const PLACEHOLDER = /\{q\}/g

/** Substitute {q} into a url template, percent-encoding the value. */
export const fillUrl = (template: string, value: string): string =>
  template.replace(PLACEHOLDER, () => encodeURIComponent(value))

/**
 * Substitute {q} into every string of a JSON-like structure. The value is
 * inserted into parsed strings, never into raw JSON text, so it cannot break
 * out of its field once serialized. Returns a new structure.
 */
export function fillDeep<T>(input: T, value: string): T {
  if (typeof input === 'string') return input.replace(PLACEHOLDER, () => value) as T
  if (Array.isArray(input)) return input.map((item) => fillDeep(item, value)) as T
  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, item]) => [key, fillDeep(item, value)]),
    ) as T
  }
  return input
}
