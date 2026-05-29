import type { RawPayload } from './types'

export type DetailRecord = Record<string, unknown> | undefined

export function stringDetail(
  details: DetailRecord,
  key: string,
): string | undefined {
  const value = details?.[key]

  return typeof value === 'string' ? value : undefined
}

export function stringArrayDetail(
  details: DetailRecord,
  key: string,
): string[] {
  const value = details?.[key]

  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : []
}

export function textByteLength(value: string): number {
  return value.length
}

export function isRawPayload(value: unknown): value is RawPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof (value as RawPayload).data === 'string' &&
    !('type' in value)
  )
}

