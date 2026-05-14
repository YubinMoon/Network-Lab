const IPV4_OCTET_COUNT = 4
const IPV4_BITS = 32
const OCTET_BITS = 8
const MAX_IPV4_VALUE = 0xffffffff
const DECIMAL_OCTET_PATTERN = /^\d+$/

export function parseIpv4(ip: string): number {
  const parts = ip.split('.')

  if (parts.length !== IPV4_OCTET_COUNT) {
    throw new Error(`Invalid IPv4 address: ${ip}`)
  }

  return parts.reduce((value, part) => {
    if (!DECIMAL_OCTET_PATTERN.test(part)) {
      throw new Error(`Invalid IPv4 address: ${ip}`)
    }

    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new Error(`Invalid IPv4 address: ${ip}`)
    }

    return ((value << OCTET_BITS) | octet) >>> 0
  }, 0)
}

export function formatIpv4(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_IPV4_VALUE) {
    throw new Error(`Invalid IPv4 numeric value: ${value}`)
  }

  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.')
}

export function isValidIpv4(ip: string): boolean {
  try {
    parseIpv4(ip)
    return true
  } catch {
    return false
  }
}

export function isValidPrefixLength(prefix: number): boolean {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= IPV4_BITS
}

export function networkAddress(ip: string, prefix: number): string {
  return formatIpv4((parseIpv4(ip) & prefixMask(prefix)) >>> 0)
}

export function broadcastAddress(ip: string, prefix: number): string {
  const network = parseIpv4(networkAddress(ip, prefix))
  const hostMask = (~prefixMask(prefix)) >>> 0
  return formatIpv4((network | hostMask) >>> 0)
}

export function ipMatchesPrefix(
  ip: string,
  network: string,
  prefix: number,
): boolean {
  const mask = prefixMask(prefix)
  return (parseIpv4(ip) & mask) >>> 0 === (parseIpv4(network) & mask) >>> 0
}

export function toBinaryIpv4(ip: string): string {
  return ip
    .split('.')
    .map((part) => {
      const octet = Number(part)
      if (!DECIMAL_OCTET_PATTERN.test(part) || octet < 0 || octet > 255) {
        throw new Error(`Invalid IPv4 address: ${ip}`)
      }

      return octet.toString(2).padStart(OCTET_BITS, '0')
    })
    .join('.')
}

export function toBinaryPrefixPattern(network: string, prefix: number): string {
  if (!isValidPrefixLength(prefix)) {
    throw new Error(`Invalid prefix length: ${prefix}`)
  }

  const bits = toBinaryIpv4(network).replaceAll('.', '')
  const pattern = `${bits.slice(0, prefix)}${'x'.repeat(IPV4_BITS - prefix)}`
  return pattern.match(/.{1,8}/g)?.join('.') ?? ''
}

export function hostAddressFromOffset(
  network: string,
  prefix: number,
  offset: number,
): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`Invalid host offset: ${offset}`)
  }

  const base = parseIpv4(networkAddress(network, prefix))
  const broadcast = parseIpv4(broadcastAddress(network, prefix))
  const address = base + offset

  if (address > broadcast) {
    throw new Error(`Host offset ${offset} is outside ${network}/${prefix}`)
  }

  return formatIpv4(address)
}

function prefixMask(prefix: number): number {
  if (!isValidPrefixLength(prefix)) {
    throw new Error(`Invalid prefix length: ${prefix}`)
  }

  return prefix === 0 ? 0 : (MAX_IPV4_VALUE << (IPV4_BITS - prefix)) >>> 0
}
