import { describe, expect, test } from 'vitest'
import { linkAnimationsForEvent } from '../components/canvas/linkAnimation'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type NetworkLink,
  type SimulationEvent,
  type TopologyState,
} from '../domain/types'

describe('Link packet animation direction', () => {
  test('uses the topology link direction for A to B traffic', () => {
    const animations = linkAnimationsForEvent(
      directTopology(),
      packetDeliveredEvent('host-a-eth0', 'host-b-eth0'),
    )

    expect(animations.get('link-1')).toBe('source-to-target')
  })

  test('reverses the topology link direction for B to A traffic', () => {
    const animations = linkAnimationsForEvent(
      directTopology(),
      packetDeliveredEvent('host-b-eth0', 'host-a-eth0'),
    )

    expect(animations.get('link-1')).toBe('target-to-source')
  })
})

function directTopology(): TopologyState {
  return {
    nodes: [host('host-a', 'Host A'), host('host-b', 'Host B')],
    links: [link()],
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}

function host(id: string, name: string): HostNode {
  return {
    id,
    type: 'host',
    name,
    position: { x: 0, y: 0 },
    interfaces: [
      {
        id: `${id}-eth0`,
        nodeId: id,
        name: 'eth0',
        macAddress: id === 'host-a' ? '02:00:00:00:00:0A' : '02:00:00:00:00:0B',
        connectedLinkIds: ['link-1'],
        status: 'up',
        autoAssigned: true,
        manualOverride: false,
      },
    ],
    arpCache: [],
  }
}

function link(): NetworkLink {
  return {
    id: 'link-1',
    endpointA: {
      nodeId: 'host-a',
      interfaceId: 'host-a-eth0',
    },
    endpointB: {
      nodeId: 'host-b',
      interfaceId: 'host-b-eth0',
    },
    status: 'up',
    delayMs: 100,
    lossRate: 0,
  }
}

function packetDeliveredEvent(
  sourceInterfaceId: string,
  deliveredInterfaceId: string,
): SimulationEvent {
  return {
    id: 'event-1',
    timeMs: 0,
    type: 'packet-delivered',
    actorNodeId: deliveredInterfaceId.startsWith('host-a') ? 'host-a' : 'host-b',
    packetId: 'packet-1',
    description: 'Packet delivered.',
    visualAction: { type: 'none' },
    details: {
      sourceInterfaceId,
      deliveredInterfaceId,
    },
  }
}
