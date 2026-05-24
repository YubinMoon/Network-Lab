import { describe, expect, test } from 'vitest'
import { linkAnimationsForEvent } from '../components/canvas/linkAnimation'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type NetworkLink,
  type NetworkNode,
  type SimulationEvent,
  type SwitchNode,
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

  test('shows only the first physical hop when a host sends an ARP Reply through a switch', () => {
    const animations = linkAnimationsForEvent(
      switchedTopology(),
      arpReplySentEvent('host-a-eth0', 'host-b-eth0'),
    )

    expect(animations.get('link-a-switch')).toBe('source-to-target')
    expect(animations.has('link-switch-b')).toBe(false)
  })

  test('shows only the first physical hop when a host sends an ARP Request through a switch', () => {
    const animations = linkAnimationsForEvent(
      switchedTopology(),
      arpRequestSentEvent('host-b-eth0'),
    )

    expect(animations.get('link-switch-b')).toBe('target-to-source')
    expect(animations.has('link-a-switch')).toBe(false)
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

function switchedTopology(): TopologyState {
  const nodes: NetworkNode[] = [
    hostWithSegment('host-a', 'Host A', 'host-a-eth0'),
    switchNode(),
    hostWithSegment('host-b', 'Host B', 'host-b-eth0'),
  ]

  return {
    nodes,
    links: [
      {
        id: 'link-a-switch',
        endpointA: {
          nodeId: 'host-a',
          interfaceId: 'host-a-eth0',
        },
        endpointB: {
          nodeId: 'switch-s1',
          interfaceId: 'switch-s1-e0-1',
        },
        status: 'up',
        delayMs: 100,
        lossRate: 0,
        mtu: 1500,
      },
      {
        id: 'link-switch-b',
        endpointA: {
          nodeId: 'switch-s1',
          interfaceId: 'switch-s1-e0-2',
        },
        endpointB: {
          nodeId: 'host-b',
          interfaceId: 'host-b-eth0',
        },
        status: 'up',
        delayMs: 100,
        lossRate: 0,
        mtu: 1500,
      },
    ],
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

function hostWithSegment(
  id: string,
  name: string,
  interfaceId: string,
): HostNode {
  return {
    id,
    type: 'host',
    name,
    position: { x: 0, y: 0 },
    interfaces: [
      {
        id: interfaceId,
        nodeId: id,
        name: 'eth0',
        macAddress: id === 'host-a' ? '02:00:00:00:00:0A' : '02:00:00:00:00:0B',
        connectedLinkIds:
          id === 'host-a' ? ['link-a-switch'] : ['link-switch-b'],
        status: 'up',
        autoAssigned: true,
        manualOverride: false,
        segmentId: 'segment-1',
      },
    ],
    arpCache: [],
  }
}

function switchNode(): SwitchNode {
  return {
    id: 'switch-s1',
    type: 'switch',
    name: 'Switch S1',
    position: { x: 0, y: 0 },
    interfaces: [
      {
        id: 'switch-s1-e0-1',
        nodeId: 'switch-s1',
        name: 'e0/1',
        macAddress: '02:00:00:00:01:01',
        connectedLinkIds: ['link-a-switch'],
        status: 'up',
        autoAssigned: true,
        manualOverride: false,
        segmentId: 'segment-1',
      },
      {
        id: 'switch-s1-e0-2',
        nodeId: 'switch-s1',
        name: 'e0/2',
        macAddress: '02:00:00:00:01:02',
        connectedLinkIds: ['link-switch-b'],
        status: 'up',
        autoAssigned: true,
        manualOverride: false,
        segmentId: 'segment-1',
      },
    ],
    macAddressTable: [],
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
    mtu: 1500,
  }
}

function arpReplySentEvent(
  sourceInterfaceId: string,
  requesterInterfaceId: string,
): SimulationEvent {
  return {
    id: 'event-1',
    timeMs: 0,
    type: 'arp-reply-sent',
    actorNodeId: 'host-a',
    packetId: 'packet-1',
    description: 'Host A sent ARP Reply for 10.0.1.10.',
    visualAction: { type: 'none' },
    details: {
      sourceInterfaceId,
      requesterInterfaceId,
    },
  }
}

function arpRequestSentEvent(sourceInterfaceId: string): SimulationEvent {
  return {
    id: 'event-1',
    timeMs: 0,
    type: 'arp-request-sent',
    actorNodeId: 'host-b',
    packetId: 'packet-1',
    description: 'Host B sent ARP Request for 10.0.1.10.',
    visualAction: { type: 'none' },
    details: {
      sourceInterfaceId,
      targetIp: '10.0.1.10',
    },
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
