import { createHash } from 'node:crypto'

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export const md5Hex = (input: string): string => createHash('md5').update(input).digest('hex')

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input).digest('hex')
