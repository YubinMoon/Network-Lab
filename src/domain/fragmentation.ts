import { DEFAULT_LINK_MTU, type IPv4Datagram } from './types'
import { isRawPayload, textByteLength } from './inspectionUtils'

export const IPV4_HEADER_LENGTH_BYTES = 20
export const ICMP_HEADER_LENGTH_BYTES = 8
const MIN_FRAGMENT_BLOCK_BYTES = 8

export interface FragmentationResult {
  status: 'unchanged' | 'fragmented' | 'dropped'
  datagrams: IPv4Datagram[]
  mtu: number
  maxFragmentPayloadLength: number
  reason?: 'Fragmentation Needed' | 'MTU Too Small'
}

export function normalizeMtu(mtu: number | undefined): number {
  if (!mtu || !Number.isFinite(mtu)) {
    return DEFAULT_LINK_MTU
  }

  return Math.max(
    IPV4_HEADER_LENGTH_BYTES + MIN_FRAGMENT_BLOCK_BYTES,
    Math.floor(mtu),
  )
}

export function ipv4PayloadLength(datagram: IPv4Datagram): number {
  if (datagram.fragmentPayloadLength !== undefined) {
    return datagram.fragmentPayloadLength
  }

  if (isRawPayload(datagram.payload)) {
    return textByteLength(datagram.payload.data)
  }

  return ICMP_HEADER_LENGTH_BYTES + textByteLength(datagram.payload.data ?? '')
}

export function ipv4TotalLength(datagram: IPv4Datagram): number {
  return IPV4_HEADER_LENGTH_BYTES + ipv4PayloadLength(datagram)
}

export function fragmentIpv4Datagram(
  datagram: IPv4Datagram,
  mtu: number | undefined,
): FragmentationResult {
  const normalizedMtu = normalizeMtu(mtu)
  const payloadLength = ipv4PayloadLength(datagram)
  const totalLength = IPV4_HEADER_LENGTH_BYTES + payloadLength
  const maxFragmentPayloadLength = Math.floor(
    (normalizedMtu - IPV4_HEADER_LENGTH_BYTES) / MIN_FRAGMENT_BLOCK_BYTES,
  ) * MIN_FRAGMENT_BLOCK_BYTES

  if (totalLength <= normalizedMtu) {
    return {
      status: 'unchanged',
      datagrams: [datagram],
      mtu: normalizedMtu,
      maxFragmentPayloadLength,
    }
  }

  if (datagram.dontFragment) {
    return {
      status: 'dropped',
      datagrams: [],
      mtu: normalizedMtu,
      maxFragmentPayloadLength,
      reason: 'Fragmentation Needed',
    }
  }

  if (maxFragmentPayloadLength <= 0) {
    return {
      status: 'dropped',
      datagrams: [],
      mtu: normalizedMtu,
      maxFragmentPayloadLength,
      reason: 'MTU Too Small',
    }
  }

  const fragments: IPv4Datagram[] = []
  let consumedBytes = 0

  while (consumedBytes < payloadLength) {
    const remainingBytes = payloadLength - consumedBytes
    const fragmentPayloadLength = Math.min(
      maxFragmentPayloadLength,
      remainingBytes,
    )
    const moreFragments = consumedBytes + fragmentPayloadLength < payloadLength

    fragments.push({
      ...datagram,
      id: `${datagram.id}-frag-${fragments.length + 1}`,
      originalDatagramId: datagram.originalDatagramId ?? datagram.id,
      moreFragments,
      fragmentOffset:
        datagram.fragmentOffset + consumedBytes / MIN_FRAGMENT_BLOCK_BYTES,
      fragmentPayloadLength,
      payload: fragmentPayload(
        datagram.payload,
        consumedBytes,
        fragmentPayloadLength,
      ),
    })
    consumedBytes += fragmentPayloadLength
  }

  return {
    status: 'fragmented',
    datagrams: fragments,
    mtu: normalizedMtu,
    maxFragmentPayloadLength,
  }
}

export function ipv4FlagsValue(datagram: IPv4Datagram): number {
  return (
    (datagram.dontFragment ? 0x4000 : 0) |
    (datagram.moreFragments ? 0x2000 : 0)
  )
}

export function ipv4HeaderChecksum(datagram: IPv4Datagram): string {
  const words = [
    0x4500,
    ipv4TotalLength(datagram),
    identificationWord(datagram.identification),
    ipv4FlagsValue(datagram) | datagram.fragmentOffset,
    (datagram.ttl << 8) | protocolNumber(datagram),
    0,
    ...ipv4Words(datagram.srcIp),
    ...ipv4Words(datagram.dstIp),
  ]
  const checksum = onesComplementChecksum(words)

  return `0x${checksum.toString(16).padStart(4, '0').toUpperCase()}`
}

export function ipv4IdentificationValue(datagram: IPv4Datagram): number {
  return identificationWord(datagram.identification)
}

export function protocolNumber(datagram: IPv4Datagram): number {
  return datagram.protocol === 'ICMP' ? 1 : 253
}

function fragmentPayload(
  payload: IPv4Datagram['payload'],
  offsetBytes: number,
  lengthBytes: number,
): IPv4Datagram['payload'] {
  if (isRawPayload(payload)) {
    return { data: payload.data.slice(offsetBytes, offsetBytes + lengthBytes) }
  }

  const icmpHeaderBytes = offsetBytes === 0 ? ICMP_HEADER_LENGTH_BYTES : 0
  const dataOffset = Math.max(offsetBytes - ICMP_HEADER_LENGTH_BYTES, 0)
  const dataLength = Math.max(lengthBytes - icmpHeaderBytes, 0)

  if (offsetBytes === 0) {
    return {
      ...payload,
      data: payload.data?.slice(dataOffset, dataOffset + dataLength) ?? '',
    }
  }

  return {
    data: payload.data?.slice(dataOffset, dataOffset + lengthBytes) ?? '',
  }
}

function identificationWord(identification: string): number {
  let hash = 0

  for (let index = 0; index < identification.length; index += 1) {
    hash = (hash * 31 + identification.charCodeAt(index)) & 0xffff
  }

  return hash
}

function ipv4Words(ipAddress: string): number[] {
  const octets = ipAddress.split('.').map((part) => Number(part))

  return [
    ((octets[0] ?? 0) << 8) | (octets[1] ?? 0),
    ((octets[2] ?? 0) << 8) | (octets[3] ?? 0),
  ]
}

function onesComplementChecksum(words: number[]): number {
  let sum = 0

  for (const word of words) {
    sum += word
    sum = (sum & 0xffff) + (sum >>> 16)
  }

  return (~sum) & 0xffff
}
