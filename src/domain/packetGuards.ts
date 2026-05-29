import type {
  ArpMessage,
  EthernetFrame,
  IcmpMessage,
  IPv4Datagram,
} from './types'

export function isEthernetFrame(value: unknown): value is EthernetFrame {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'srcMac' in value &&
    'dstMac' in value &&
    'etherType' in value &&
    'payload' in value
  )
}

export function isArpMessage(value: unknown): value is ArpMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operation' in value &&
    'senderIp' in value &&
    'senderMac' in value &&
    'targetIp' in value
  )
}

export function isIpv4Datagram(value: unknown): value is IPv4Datagram {
  return (
    typeof value === 'object' &&
    value !== null &&
    'srcIp' in value &&
    'dstIp' in value &&
    'ttl' in value &&
    'protocol' in value &&
    'payload' in value
  )
}

export function isIcmpMessage(value: unknown): value is IcmpMessage {
  return typeof value === 'object' && value !== null && 'type' in value
}
