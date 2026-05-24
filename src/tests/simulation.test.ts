import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { applySimulationTraceToTopology } from '../domain/dynamicTables'
import {
  simulateIpv4Packet,
  simulateIpv4PacketBatch,
} from '../domain/simulation'
import {
  DEFAULT_LAB_SETTINGS,
  type EthernetFrame,
  type HostNode,
  type InterfaceId,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type RouterNode,
  type SimulationEvent,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'

describe('IPv4 forwarding simulation', () => {
  test('forwards a datagram across one router and rewrites Ethernet headers', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      payload: 'Hello',
    })
    const ttlEvent = eventByType(trace.events, 'router-ttl-decremented')
    const encapsulatedFrame = eventByType(
      trace.events,
      'router-frame-encapsulated',
    ).details?.ethernetFrame as EthernetFrame

    expect(trace.result.status).toBe('delivered')
    expect(ttlEvent.details).toEqual(
      expect.objectContaining({
        previousTtl: 64,
        nextTtl: 63,
      }),
    )
    expect(encapsulatedFrame.srcMac).toBe(
      interfaceByName(topology, 'router-r1', 'g0/1').macAddress,
    )
    expect(encapsulatedFrame.dstMac).toBe(
      interfaceByName(topology, 'host-b', 'eth0').macAddress,
    )
    expect(encapsulatedFrame.payload).toEqual(
      expect.objectContaining({
        srcIp: '10.0.1.10',
        dstIp: '10.0.2.10',
        ttl: 63,
      }),
    )
  })

  test('records ARP reply, ARP cache update, and switch MAC learning events', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      payload: 'Hello',
    })
    const nextTopology = applySimulationTraceToTopology(topology, trace)
    const hostA = nextTopology.nodes.find(
      (node): node is HostNode => node.id === 'host-a' && node.type === 'host',
    )
    const switchS1 = nextTopology.nodes.find(
      (node): node is SwitchNode =>
        node.id === 'switch-s1' && node.type === 'switch',
    )

    expect(trace.events.some((event) => event.type === 'arp-reply-sent')).toBe(
      true,
    )
    expect(
      trace.events.some((event) => event.type === 'arp-cache-updated'),
    ).toBe(true)
    expect(
      trace.events.some((event) => event.type === 'switch-source-mac-learned'),
    ).toBe(true)
    expect(
      trace.events.some((event) => event.type === 'switch-broadcast-flooded'),
    ).toBe(true)
    expect(hostA?.arpCache).toHaveLength(1)
    expect(switchS1?.macAddressTable.length).toBeGreaterThan(0)
  })

  test('records known unicast switch forwarding only on the learned egress port', () => {
    const topology = applyAutoConfiguration(threeHostSwitchTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.1.12',
      ttl: 64,
      packetType: 'generic-ipv4',
    })
    const hostAMacAddress = interfaceByName(topology, 'host-a', 'eth0')
      .macAddress
    const arpReplyForwardedEvent = trace.events.find(
      (event) =>
        event.type === 'switch-known-unicast-forwarded' &&
        event.details?.destinationMac === hostAMacAddress,
    )

    expect(arpReplyForwardedEvent?.details).toEqual(
      expect.objectContaining({
        ingressInterfaceId: 'switch-s1-e0-3',
        egressInterfaceIds: ['switch-s1-e0-1'],
      }),
    )
  })

  test('uses the Host interface that matches the destination subnet', () => {
    const topology = applyAutoConfiguration(hostWithSeparateHostLinkTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-b',
      destinationIp: '10.0.2.11',
      ttl: 64,
      packetType: 'generic-ipv4',
    })
    const subnetCheckEvent = eventByType(trace.events, 'host-subnet-check')
    const arpRequestEvent = eventByType(trace.events, 'arp-request-sent')
    const deliveredEvent = eventByType(trace.events, 'packet-delivered')

    expect(trace.result.status).toBe('delivered')
    expect(subnetCheckEvent.details).toEqual(
      expect.objectContaining({
        sourceIp: '10.0.2.10',
        prefixLength: 24,
      }),
    )
    expect(arpRequestEvent.details).toEqual(
      expect.objectContaining({
        sourceInterfaceId: 'host-b-eth1',
      }),
    )
    expect(deliveredEvent.details).toEqual(
      expect.objectContaining({
        sourceInterfaceId: 'host-b-eth1',
        deliveredInterfaceId: 'host-c-eth0',
      }),
    )
  })

  test('applies dynamic table events only through the selected event index', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      payload: 'Hello',
    })
    const missIndex = trace.events.findIndex(
      (event) => event.type === 'arp-cache-miss' && event.actorNodeId === 'host-a',
    )
    const updateIndex = trace.events.findIndex(
      (event) =>
        event.type === 'arp-cache-updated' && event.actorNodeId === 'host-a',
    )
    const topologyAtMiss = applySimulationTraceToTopology(
      topology,
      trace,
      missIndex,
    )
    const topologyAtUpdate = applySimulationTraceToTopology(
      topology,
      trace,
      updateIndex,
    )

    expect(missIndex).toBeGreaterThanOrEqual(0)
    expect(updateIndex).toBeGreaterThan(missIndex)
    expect(hostById(topologyAtMiss, 'host-a').arpCache).toHaveLength(0)
    expect(hostById(topologyAtUpdate, 'host-a').arpCache).toHaveLength(1)
  })

  test('uses ARP Cache hits after dynamic tables are populated', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const firstTrace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'generic-ipv4',
    })
    const topologyWithCache = applySimulationTraceToTopology(topology, firstTrace)
    const secondTrace = simulateIpv4Packet(topologyWithCache, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'generic-ipv4',
    })

    expect(
      secondTrace.events.some((event) => event.type === 'arp-cache-hit'),
    ).toBe(true)
    expect(
      secondTrace.events.filter((event) => event.type === 'arp-request-sent'),
    ).toHaveLength(0)
  })

  test('drops external host traffic with no Default Gateway', () => {
    const topology = applyAutoConfiguration(
      topologyState([host('host-a', 'Host A')], []),
    )
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
    })

    expect(trace.result).toEqual({
      status: 'dropped',
      reason: 'No Default Gateway',
    })
  })

  test('drops at router when no route matches', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const routerR1 = router('router-r1', 'Router R1', ['g0/0'])
    const topology = applyAutoConfiguration(
      topologyState(
        [hostA, switchS1, routerR1],
        [
          link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
          link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
        ],
      ),
    )
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.99.10',
      ttl: 64,
    })

    expect(trace.result).toEqual({
      status: 'dropped',
      reason: 'No Matching Route',
    })
  })

  test('drops when TTL expires at a router', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 1,
    })

    expect(trace.result).toEqual({
      status: 'dropped',
      reason: 'TTL Expired',
    })
    expect(eventByType(trace.events, 'packet-dropped').details).toEqual({
      reason: 'TTL Expired',
    })
  })

  test('drops on a fully lossy link in the selected Layer 2 path', () => {
    const topology = applyAutoConfiguration({
      ...firstMilestoneTopology(),
      links: firstMilestoneTopology().links.map((networkLink) =>
        networkLink.id === 'link-3'
          ? { ...networkLink, lossRate: 1 }
          : networkLink,
      ),
    })
    const trace = simulateIpv4Packet(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'generic-ipv4',
    })

    expect(trace.result).toEqual({
      status: 'dropped',
      reason: 'Link Loss',
    })
  })

  test('can produce a deterministic trace for multiple datagrams', () => {
    const topology = applyAutoConfiguration(firstMilestoneTopology())
    const trace = simulateIpv4PacketBatch(topology, {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'generic-ipv4',
      packetCount: 3,
    })
    const deliveredEvents = trace.events.filter(
      (event) => event.type === 'packet-delivered',
    )
    const packetIds = new Set(
      trace.events
        .map((event) => event.packetId)
        .filter((packetId): packetId is string => Boolean(packetId)),
    )

    expect(trace.result.status).toBe('delivered')
    expect(deliveredEvents).toHaveLength(3)
    expect(packetIds.has('packet-1')).toBe(true)
    expect(packetIds.has('packet-2')).toBe(true)
    expect(packetIds.has('packet-3')).toBe(true)
  })
})

function firstMilestoneTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const routerR1 = router('router-r1', 'Router R1', ['g0/0', 'g0/1'])
  const switchS2 = switchNode('switch-s2', 'Switch S2', ['e0/1', 'e0/2'])
  const hostB = host('host-b', 'Host B')

  return topologyState(
    [hostA, switchS1, routerR1, switchS2, hostB],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
      link('link-3', endpoint(routerR1, 'g0/1'), endpoint(switchS2, 'e0/1')),
      link('link-4', endpoint(switchS2, 'e0/2'), endpoint(hostB, 'eth0')),
    ],
  )
}

function threeHostSwitchTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', [
    'e0/1',
    'e0/2',
    'e0/3',
  ])
  const hostB = host('host-b', 'Host B')
  const hostC = host('host-c', 'Host C')

  return topologyState(
    [hostA, switchS1, hostB, hostC],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(hostB, 'eth0')),
      link('link-3', endpoint(switchS1, 'e0/3'), endpoint(hostC, 'eth0')),
    ],
  )
}

function hostWithSeparateHostLinkTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const hostB = {
    ...host('host-b', 'Host B'),
    interfaces: [
      networkInterface('host-b', 'eth0'),
      networkInterface('host-b', 'eth1'),
    ],
  } satisfies HostNode
  const hostC = host('host-c', 'Host C')

  return topologyState(
    [hostA, switchS1, hostB, hostC],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(hostB, 'eth0')),
      link('link-3', endpoint(hostB, 'eth1'), endpoint(hostC, 'eth0')),
    ],
  )
}

function topologyState(
  nodes: NetworkNode[],
  links: NetworkLink[],
): TopologyState {
  return {
    nodes,
    links,
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
    interfaces: [networkInterface(id, 'eth0')],
    arpCache: [],
  }
}

function switchNode(
  id: string,
  name: string,
  interfaceNames: string[],
): SwitchNode {
  return {
    id,
    type: 'switch',
    name,
    position: { x: 0, y: 0 },
    interfaces: interfaceNames.map((interfaceName) =>
      networkInterface(id, interfaceName),
    ),
    macAddressTable: [],
  }
}

function router(
  id: string,
  name: string,
  interfaceNames: string[],
): RouterNode {
  return {
    id,
    type: 'router',
    name,
    position: { x: 0, y: 0 },
    interfaces: interfaceNames.map((interfaceName) =>
      networkInterface(id, interfaceName),
    ),
    routingTable: [],
    arpCache: [],
  }
}

function networkInterface(nodeId: string, name: string): NetworkInterface {
  const id = interfaceId(nodeId, name)

  return {
    id,
    nodeId,
    name,
    macAddress: macAddressFor(id),
    connectedLinkIds: [],
    status: 'up',
    autoAssigned: true,
    manualOverride: false,
  }
}

function interfaceId(nodeId: string, name: string): InterfaceId {
  return `${nodeId}-${name.replaceAll('/', '-')}`
}

function endpoint(node: NetworkNode, interfaceName: string): LinkEndpoint {
  return {
    nodeId: node.id,
    interfaceId: interfaceId(node.id, interfaceName),
  }
}

function link(
  id: string,
  endpointA: LinkEndpoint,
  endpointB: LinkEndpoint,
): NetworkLink {
  return {
    id,
    endpointA,
    endpointB,
    status: 'up',
    delayMs: 100,
    lossRate: 0,
  }
}

function interfaceByName(
  topology: TopologyState,
  nodeId: string,
  name: string,
): NetworkInterface {
  const networkInterface = topology.nodes
    .find((node) => node.id === nodeId)
    ?.interfaces.find((candidate) => candidate.name === name)

  if (!networkInterface) {
    throw new Error(`Missing interface ${nodeId} ${name}`)
  }

  return networkInterface
}

function eventByType(
  events: SimulationEvent[],
  type: SimulationEvent['type'],
): SimulationEvent {
  const event = events.find((candidate) => candidate.type === type)

  if (!event) {
    throw new Error(`Missing event ${type}`)
  }

  return event
}

function hostById(topology: TopologyState, id: string): HostNode {
  const node = topology.nodes.find(
    (candidate): candidate is HostNode =>
      candidate.id === id && candidate.type === 'host',
  )

  if (!node) {
    throw new Error(`Missing host ${id}`)
  }

  return node
}

function macAddressFor(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 256
  }

  return `02:00:00:00:00:${hash.toString(16).padStart(2, '0').toUpperCase()}`
}
