import { ipMatchesPrefix } from './ip'
import { normalizeMac } from './mac'
import {
  BROADCAST_MAC,
  type ArpCacheEntry,
  type ArpMessage,
  type EthernetFrame,
  type NetworkInterface,
  type PacketDropReason,
} from './types'

export type HostArpTargetResult =
  | { status: 'ok'; targetIp: string; reason: 'same-subnet' | 'default-gateway' }
  | { status: 'drop'; reason: PacketDropReason }

export function selectHostArpTarget(
  sourceIp: string,
  prefixLength: number,
  destinationIp: string,
  defaultGatewayIp?: string,
): HostArpTargetResult {
  if (ipMatchesPrefix(destinationIp, sourceIp, prefixLength)) {
    return {
      status: 'ok',
      targetIp: destinationIp,
      reason: 'same-subnet',
    }
  }

  if (!defaultGatewayIp) {
    return {
      status: 'drop',
      reason: 'No Default Gateway',
    }
  }

  return {
    status: 'ok',
    targetIp: defaultGatewayIp,
    reason: 'default-gateway',
  }
}

export function findArpCacheEntry(
  arpCache: ArpCacheEntry[],
  ipAddress: string,
): ArpCacheEntry | undefined {
  return arpCache.find((entry) => entry.ipAddress === ipAddress)
}

export function updateArpCache(
  arpCache: ArpCacheEntry[],
  entry: Omit<ArpCacheEntry, 'ageSeconds' | 'source'> &
    Partial<Pick<ArpCacheEntry, 'ageSeconds' | 'source'>>,
): ArpCacheEntry[] {
  const nextEntry: ArpCacheEntry = {
    ...entry,
    macAddress: normalizeMac(entry.macAddress),
    ageSeconds: entry.ageSeconds ?? 0,
    source: entry.source ?? 'dynamic',
  }

  if (findArpCacheEntry(arpCache, nextEntry.ipAddress)) {
    return arpCache.map((candidate) =>
      candidate.ipAddress === nextEntry.ipAddress ? nextEntry : candidate,
    )
  }

  return [...arpCache, nextEntry]
}

export function createArpRequestFrame({
  frameId,
  senderIp,
  senderMac,
  targetIp,
}: {
  frameId: string
  senderIp: string
  senderMac: string
  targetIp: string
}): EthernetFrame {
  return {
    id: frameId,
    srcMac: normalizeMac(senderMac),
    dstMac: BROADCAST_MAC,
    etherType: 'ARP',
    payload: {
      operation: 'request',
      senderIp,
      senderMac: normalizeMac(senderMac),
      targetIp,
    },
  }
}

export function createArpReplyFrame({
  frameId,
  senderIp,
  senderMac,
  targetIp,
  targetMac,
}: {
  frameId: string
  senderIp: string
  senderMac: string
  targetIp: string
  targetMac: string
}): EthernetFrame {
  return {
    id: frameId,
    srcMac: normalizeMac(senderMac),
    dstMac: normalizeMac(targetMac),
    etherType: 'ARP',
    payload: {
      operation: 'reply',
      senderIp,
      senderMac: normalizeMac(senderMac),
      targetIp,
      targetMac: normalizeMac(targetMac),
    },
  }
}

export function createReplyForArpRequest(
  requestFrame: EthernetFrame,
  receiverInterface: NetworkInterface,
  frameId: string,
): EthernetFrame | undefined {
  if (requestFrame.etherType !== 'ARP') {
    return undefined
  }

  const message = requestFrame.payload as ArpMessage

  if (
    message.operation !== 'request' ||
    !receiverInterface.ipAddress ||
    receiverInterface.ipAddress !== message.targetIp
  ) {
    return undefined
  }

  return createArpReplyFrame({
    frameId,
    senderIp: receiverInterface.ipAddress,
    senderMac: receiverInterface.macAddress,
    targetIp: message.senderIp,
    targetMac: message.senderMac,
  })
}

export function applyArpReplyToCache(
  arpCache: ArpCacheEntry[],
  replyFrame: EthernetFrame,
  interfaceId: string,
): ArpCacheEntry[] {
  if (replyFrame.etherType !== 'ARP') {
    return arpCache
  }

  const message = replyFrame.payload as ArpMessage

  if (message.operation !== 'reply') {
    return arpCache
  }

  return updateArpCache(arpCache, {
    ipAddress: message.senderIp,
    macAddress: message.senderMac,
    interfaceId,
  })
}
