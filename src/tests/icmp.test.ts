import { describe, expect, test } from 'vitest'
import { createIcmpEchoReply, createIcmpEchoRequest } from '../domain/icmp'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { simulateIpv4Packet } from '../domain/simulation'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type InterfaceId,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type RouterNode,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'

describe('ICMP Echo and Generic IPv4 packets', () => {
  test('creates ICMP Echo Reply from ICMP Echo Request fields', () => {
    const request = createIcmpEchoRequest({
      identifier: 42,
      sequenceNumber: 7,
      data: 'Hello',
    })

    expect(createIcmpEchoReply(request)).toEqual({
      type: 'echo-reply',
      identifier: 42,
      sequenceNumber: 7,
      data: 'Hello',
    })
  })

  test('delivers ICMP Echo Request and generated ICMP Echo Reply', () => {
    const trace = simulateIpv4Packet(applyAutoConfiguration(firstMilestoneTopology()), {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'icmp-echo',
      payload: 'Hello',
    })
    const deliveredEvents = trace.events.filter(
      (event) => event.type === 'packet-delivered',
    )

    expect(trace.result.status).toBe('delivered')
    expect(deliveredEvents).toHaveLength(2)
    expect(deliveredEvents[0].actorNodeId).toBe('host-b')
    expect(deliveredEvents[1].actorNodeId).toBe('host-a')
    expect(trace.events.some((event) => event.packetId === 'packet-2')).toBe(true)
  })

  test('delivers Generic IPv4 Packet without generating a reply', () => {
    const trace = simulateIpv4Packet(applyAutoConfiguration(firstMilestoneTopology()), {
      sourceHostId: 'host-a',
      destinationIp: '10.0.2.10',
      ttl: 64,
      packetType: 'generic-ipv4',
      payload: 'Hello',
    })

    expect(trace.result.status).toBe('delivered')
    expect(
      trace.events.filter((event) => event.type === 'packet-delivered'),
    ).toHaveLength(1)
    expect(trace.events.some((event) => event.packetId === 'packet-2')).toBe(false)
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
  return {
    id: interfaceId(nodeId, name),
    nodeId,
    name,
    macAddress: '02:00:00:00:00:01',
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
