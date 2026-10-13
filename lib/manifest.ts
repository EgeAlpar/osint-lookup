import type { ExistRules } from './classify'
import type { QueryKind } from './types'

export interface SiteDef {
  readonly name: string
  /** Human-facing profile url. */
  readonly urlTemplate: string
  /** Url actually requested, when it differs from the profile url (e.g. a JSON API). */
  readonly probeTemplate?: string
  readonly rules: ExistRules
  /**
   * JSON-API sites only: map of output label to a dotted path into the parsed
   * response, copied into the finding data when the profile is found.
   */
  readonly extract?: Readonly<Record<string, string>>
}

export type HttpMethod = 'GET' | 'POST'

export interface AccountSiteDef {
  readonly name: string
  readonly kind: QueryKind
  readonly method: HttpMethod
  readonly urlTemplate: string
  /** Link shown to the user (the service home page); never contains the query. */
  readonly displayUrl?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: unknown
  readonly rules: ExistRules
}

type Raw = Record<string, unknown>

const fail = (where: string, message: string): never => {
  throw new Error(`Invalid manifest entry ${where}: ${message}`)
}

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((v) => Number.isInteger(v))

function checkTemplate(where: string, template: unknown, requirePlaceholder: boolean): string {
  if (typeof template !== 'string') return fail(where, 'url template must be a string')
  if (requirePlaceholder && !template.includes('{q}')) {
    fail(where, 'url template must contain {q}')
  }
  const url = new URL(template.replaceAll('{q}', 'qplaceholder'))
  if (url.protocol !== 'https:') fail(where, 'url template must use https')
  if (url.hostname.includes('qplaceholder')) fail(where, '{q} must not appear in the host')
  if (url.username.includes('qplaceholder') || url.password.includes('qplaceholder')) {
    fail(where, '{q} must not appear in the host (userinfo)')
  }
  if (url.username !== '' || url.password !== '') fail(where, 'url template must not carry userinfo')
  return template
}

function checkRules(where: string, raw: unknown): ExistRules {
  if (!isRecord(raw)) return fail(where, 'rules must be an object')
  const { foundStatus, notFoundStatus, notFoundText, foundText, notFoundUrl, matchAnyStatus } = raw
  if (foundStatus !== undefined && !isNumberArray(foundStatus)) fail(where, 'bad foundStatus')
  if (notFoundStatus !== undefined && !isNumberArray(notFoundStatus)) fail(where, 'bad notFoundStatus')
  if (notFoundText !== undefined && !isStringArray(notFoundText)) fail(where, 'bad notFoundText')
  if (foundText !== undefined && !isStringArray(foundText)) fail(where, 'bad foundText')
  if (notFoundUrl !== undefined && typeof notFoundUrl !== 'string') fail(where, 'bad notFoundUrl')
  if (matchAnyStatus !== undefined && typeof matchAnyStatus !== 'boolean') {
    fail(where, 'bad matchAnyStatus')
  }
  return raw as ExistRules
}

function checkName(index: number, raw: Raw): string {
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    return fail(`#${index}`, 'name is required')
  }
  return raw.name
}

function checkExtract(
  where: string,
  raw: unknown,
): Readonly<Record<string, string>> | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw) || !Object.values(raw).every((v) => typeof v === 'string')) {
    return fail(where, 'extract must map strings to dotted-path strings')
  }
  return raw as Record<string, string>
}

export function parseSites(input: unknown): readonly SiteDef[] {
  if (!Array.isArray(input)) throw new Error('Sites manifest must be an array')
  return input.map((raw: unknown, index): SiteDef => {
    if (!isRecord(raw)) return fail(`#${index}`, 'entry must be an object')
    const name = checkName(index, raw)
    return {
      name,
      urlTemplate: checkTemplate(name, raw.urlTemplate, true),
      ...(raw.probeTemplate !== undefined && {
        probeTemplate: checkTemplate(name, raw.probeTemplate, true),
      }),
      rules: checkRules(name, raw.rules),
      ...(raw.extract !== undefined && { extract: checkExtract(name, raw.extract) }),
    }
  })
}

function checkHeaders(where: string, raw: unknown): Readonly<Record<string, string>> | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw) || !Object.values(raw).every((v) => typeof v === 'string')) {
    return fail(where, 'headers must map strings to strings')
  }
  return raw as Record<string, string>
}

export function parseAccountSites(input: unknown): readonly AccountSiteDef[] {
  if (!Array.isArray(input)) throw new Error('Account manifest must be an array')
  return input.map((raw: unknown, index): AccountSiteDef => {
    if (!isRecord(raw)) return fail(`#${index}`, 'entry must be an object')
    const name = checkName(index, raw)
    if (raw.kind !== 'email' && raw.kind !== 'username') fail(name, 'kind must be email or username')
    if (raw.method !== 'GET' && raw.method !== 'POST') fail(name, 'method must be GET or POST')

    const urlTemplate = checkTemplate(name, raw.urlTemplate, false)
    const bodyHasQuery = raw.body !== undefined && JSON.stringify(raw.body).includes('{q}')
    if (!urlTemplate.includes('{q}') && !bodyHasQuery) fail(name, '{q} must appear in url or body')

    const headers = checkHeaders(name, raw.headers)
    return {
      name,
      kind: raw.kind as QueryKind,
      method: raw.method as HttpMethod,
      urlTemplate,
      ...(typeof raw.displayUrl === 'string' && { displayUrl: raw.displayUrl }),
      ...(headers !== undefined && { headers }),
      ...(raw.body !== undefined && { body: raw.body }),
      rules: checkRules(name, raw.rules),
    }
  })
}
