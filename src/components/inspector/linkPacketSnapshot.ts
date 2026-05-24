import { linkAnimationsForEvent } from '../canvas/linkAnimation'
import type {
  EthernetFrame,
  NetworkLink,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'

export interface LinkPacketSnapshot {
  direction: 'source-to-target' | 'target-to-source'
  eventType: SimulationEvent['type']
  frame: EthernetFrame
  packetId?: string
}

export function packetOnLink(
  topology: TopologyState,
  link: NetworkLink,
  event: SimulationEvent | undefined,
): LinkPacketSnapshot | undefined {
  const frame = ethernetFrameDetail(event?.details)

  if (!event || !frame) {
    return undefined
  }

  const direction = linkAnimationsForEvent(topology, event).get(link.id)

  if (!direction) {
    return undefined
  }

  return {
    direction,
    eventType: event.type,
    frame,
    packetId: event.packetId,
  }
}

function ethernetFrameDetail(
  details: Record<string, unknown> | undefined,
): EthernetFrame | undefined {
  const value = details?.ethernetFrame

  return isEthernetFrame(value) ? value : undefined
}

function isEthernetFrame(value: unknown): value is EthernetFrame {
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
