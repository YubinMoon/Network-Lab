import { isEthernetFrame, isIpv4Datagram } from '../../domain/packetGuards'
import type { EthernetFrame, SimulationEvent } from '../../domain/types'

export type LinkPacketKind = 'arp' | 'icmp' | 'generic-ipv4'

export const LINK_PACKET_COLORS: Record<LinkPacketKind, string> = {
  arp: '#6fa8dc',
  icmp: '#66d19e',
  'generic-ipv4': '#ffb86b',
}

export function linkPacketKindForEvent(
  event: SimulationEvent | undefined,
): LinkPacketKind {
  return linkPacketKindForFrame(ethernetFrameForEvent(event))
}

export function linkPacketKindForFrame(
  frame: EthernetFrame | undefined,
): LinkPacketKind {
  if (!frame) {
    return 'generic-ipv4'
  }

  if (frame.etherType === 'ARP') {
    return 'arp'
  }

  if (isIpv4Datagram(frame.payload) && frame.payload.protocol === 'ICMP') {
    return 'icmp'
  }

  return 'generic-ipv4'
}

export function linkPacketColor(packetKind: LinkPacketKind): string {
  return LINK_PACKET_COLORS[packetKind]
}

function ethernetFrameForEvent(
  event: SimulationEvent | undefined,
): EthernetFrame | undefined {
  const value = event?.details?.ethernetFrame

  return isEthernetFrame(value) ? value : undefined
}
