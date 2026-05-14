import { BROADCAST_MAC } from './types'

const MAC_PATTERN =
  /^[0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}\1[0-9a-fA-F]{2}\1[0-9a-fA-F]{2}\1[0-9a-fA-F]{2}\1[0-9a-fA-F]{2}$/
const MAC_BYTE_COUNT = 6
const LOCALLY_ADMINISTERED_UNICAST = 0x02

export function isValidMac(mac: string): boolean {
  return MAC_PATTERN.test(mac)
}

export function normalizeMac(mac: string): string {
  if (!isValidMac(mac)) {
    throw new Error(`Invalid MAC address: ${mac}`)
  }

  return mac.replaceAll('-', ':').toUpperCase()
}

export function generateMac(seed?: string): string {
  const input = seed ?? randomSeed()
  const bytes = Array.from({ length: MAC_BYTE_COUNT }, (_, index) =>
    index === 0 ? LOCALLY_ADMINISTERED_UNICAST : hashByte(`${input}:${index}`),
  )

  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(':').toUpperCase()
}

export function isBroadcastMac(mac: string): boolean {
  return normalizeMac(mac) === BROADCAST_MAC
}

function hashByte(input: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash & 255
}

function randomSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}
