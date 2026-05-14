import { describe, expect, test } from 'vitest'
import {
  applyNetworkSegments,
  detectNetworkSegments,
} from '../domain/segments'
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

describe('Network Segment detection', () => {
  test('detects one LAN for Host A - Switch S1 - Host B', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const hostB = host('host-b', 'Host B')
    const segments = detectNetworkSegments(
      [hostA, switchS1, hostB],
      [
        link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
        link('link-2', endpoint(switchS1, 'e0/2'), endpoint(hostB, 'eth0')),
      ],
    )

    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('lan')
    expect(segments[0].memberInterfaceIds).toEqual(
      expect.arrayContaining([
        'host-a-eth0',
        'switch-s1-e0-1',
        'switch-s1-e0-2',
        'host-b-eth0',
      ]),
    )
  })

  test('keeps router interfaces in separate LAN segments', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const routerR1 = router('router-r1', 'Router R1', ['g0/0', 'g0/1'])
    const switchS2 = switchNode('switch-s2', 'Switch S2', ['e0/1', 'e0/2'])
    const hostB = host('host-b', 'Host B')
    const segments = detectNetworkSegments(
      [hostA, switchS1, routerR1, switchS2, hostB],
      [
        link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
        link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
        link('link-3', endpoint(routerR1, 'g0/1'), endpoint(switchS2, 'e0/1')),
        link('link-4', endpoint(switchS2, 'e0/2'), endpoint(hostB, 'eth0')),
      ],
    )

    expect(segments).toHaveLength(2)
    expect(segmentContaining(segments, 'host-a-eth0')).toEqual(
      expect.objectContaining({
        type: 'lan',
        memberInterfaceIds: expect.arrayContaining([
          'host-a-eth0',
          'router-r1-g0-0',
        ]),
      }),
    )
    expect(segmentContaining(segments, 'host-b-eth0')).toEqual(
      expect.objectContaining({
        type: 'lan',
        memberInterfaceIds: expect.arrayContaining([
          'host-b-eth0',
          'router-r1-g0-1',
        ]),
      }),
    )
  })

  test('classifies direct router-to-router links as point-to-point', () => {
    const routerR1 = router('router-r1', 'Router R1', ['g0/0'])
    const routerR2 = router('router-r2', 'Router R2', ['g0/0'])
    const segments = detectNetworkSegments(
      [routerR1, routerR2],
      [link('link-1', endpoint(routerR1, 'g0/0'), endpoint(routerR2, 'g0/0'))],
    )

    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('point-to-point')
    expect(segments[0].networkAddress).toBe('10.255.1.0')
    expect(segments[0].prefixLength).toBe(30)
  })

  test('applies segment ids to member interfaces and preserves identity', () => {
    const topology = topologyState(
      [
        host('host-a', 'Host A'),
        switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2']),
        host('host-b', 'Host B'),
      ],
      [
        link(
          'link-1',
          { nodeId: 'host-a', interfaceId: 'host-a-eth0' },
          { nodeId: 'switch-s1', interfaceId: 'switch-s1-e0-1' },
        ),
        link(
          'link-2',
          { nodeId: 'switch-s1', interfaceId: 'switch-s1-e0-2' },
          { nodeId: 'host-b', interfaceId: 'host-b-eth0' },
        ),
      ],
    )
    const firstPass = applyNetworkSegments(topology)
    const secondPass = applyNetworkSegments(firstPass)

    expect(firstPass.segments[0].id).toBe(secondPass.segments[0].id)
    expect(firstPass.nodes[0].interfaces[0].segmentId).toBe(
      firstPass.segments[0].id,
    )
  })
})

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

function segmentContaining(
  segments: ReturnType<typeof detectNetworkSegments>,
  interfaceIdToFind: InterfaceId,
) {
  return segments.find((segment) =>
    segment.memberInterfaceIds.includes(interfaceIdToFind),
  )
}
