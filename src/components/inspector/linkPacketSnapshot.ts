import { linkAnimationsForEvent } from '../canvas/linkAnimation'
import type {
  EthernetFrame,
  NetworkLink,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'

export interface LinkPacketSnapshot {
  frame: EthernetFrame
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

  if (!linkAnimationsForEvent(topology, event).has(link.id)) {
    return undefined
  }

  return {
    frame,
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
