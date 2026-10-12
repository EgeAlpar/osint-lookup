import type { StreamEvent } from './types'

export const encodeEvent = (event: StreamEvent): string => `${JSON.stringify(event)}\n`

/** Split a buffer into complete NDJSON lines plus the unfinished tail. */
export function splitLines(buffer: string): { readonly lines: string[]; readonly rest: string } {
  const parts = buffer.split('\n')
  const rest = parts.at(-1) ?? ''
  const lines = parts.slice(0, -1).filter((line) => line.trim() !== '')
  return { lines, rest }
}
