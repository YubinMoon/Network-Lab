import { linkAnimationsForEvent } from '../canvas/linkAnimation'
import type {
  EthernetFrame,
  NetworkLink,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'
import { isEthernetFrame } from '../../domain/packetGuards'

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
