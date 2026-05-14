import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { simulateIpv4Packet } from '../domain/simulation'
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

function macAddressFor(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 256
  }

  return `02:00:00:00:00:${hash.toString(16).padStart(2, '0').toUpperCase()}`
}
