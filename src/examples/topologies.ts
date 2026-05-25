import {
  DEFAULT_LAB_SETTINGS,
  DEFAULT_LINK_MTU,
  type CanvasPosition,
  type HostNode,
  type InterfaceId,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type PacketGeneratorInput,
  type RouteEntry,
  type RouterNode,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'
import { generateMac } from '../domain/mac'

export interface ExampleTopology {
  id: string
  name: string
  topology: TopologyState
  packet: PacketGeneratorInput
}

const EXAMPLE_NODE_SPACING_X = 220
const EXAMPLE_NODE_Y = 120

export const EXAMPLE_TOPOLOGIES: ExampleTopology[] = [
  {
    id: 'same-lan',
    name: 'Same LAN Communication',
    topology: sameLanTopology(),
    packet: hostPacket('host-a', 'host-b', 'icmp-echo'),
  },
  {
    id: 'default-gateway',
    name: 'Default Gateway Forwarding',
    topology: firstMilestoneTopology(),
    packet: hostPacket('host-a', 'host-b', 'icmp-echo'),
  },
  {
    id: 'router-to-router',
    name: 'Router-to-Router Forwarding',
    topology: twoRouterTopology(),
    packet: hostPacket('host-a', 'host-b', 'icmp-echo'),
  },
  {
    id: 'fragmentation-random-routing',
    name: 'MTU Fragmentation and Random Routing',
    topology: fragmentationRandomRoutingTopology(),
    packet: {
      ...hostPacket('host-a', 'host-b', 'generic-ipv4'),
      packetCount: 2,
      payload: 'Fragmentation payload '.repeat(12),
    },
  },
  {
    id: 'redundant-router-mesh',
    name: 'Redundant Router Mesh',
    topology: redundantRouterMeshTopology(),
    packet: hostPacket('host-a', 'host-b', 'generic-ipv4'),
  },
  {
    id: 'no-matching-route',
    name: 'No Matching Route',
    topology: oneLanOneRouterTopology(),
    packet: ipPacket('host-a', '10.0.99.10', 64),
  },
]

function sameLanTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const hostB = host('host-b', 'Host B')

  return topologyState(
    [hostA, switchS1, hostB],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(hostB, 'eth0')),
    ],
  )
}

function oneLanOneRouterTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const routerR1 = router('router-r1', 'Router R1', ['g0/0'])

  return topologyState(
    [hostA, switchS1, routerR1],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
    ],
  )
}

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

function twoRouterTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const routerR1 = router('router-r1', 'Router R1', ['g0/0', 'g0/1'])
  const routerR2 = router('router-r2', 'Router R2', ['g0/0', 'g0/1'])
  const switchS2 = switchNode('switch-s2', 'Switch S2', ['e0/1', 'e0/2'])
  const hostB = host('host-b', 'Host B')

  return topologyState(
    [hostA, switchS1, routerR1, routerR2, switchS2, hostB],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
      link('link-3', endpoint(routerR1, 'g0/1'), endpoint(routerR2, 'g0/0')),
      link('link-4', endpoint(routerR2, 'g0/1'), endpoint(switchS2, 'e0/1')),
      link('link-5', endpoint(switchS2, 'e0/2'), endpoint(hostB, 'eth0')),
    ],
  )
}

function fragmentationRandomRoutingTopology(): TopologyState {
  const hostA = host('host-a', 'Host A')
  const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
  const routerR1 = {
    ...router('router-r1', 'Router R1', ['g0/0', 'g0/1', 'g0/2']),
    routingTable: [
      {
        id: 'route-r1-manual-via-r2',
        destinationNetwork: '10.0.2.0',
        prefixLength: 24,
        nextHopIp: '10.255.1.2',
        outInterfaceId: 'router-r1-g0-1',
        type: 'manual-static',
        metric: 1,
        enabled: true,
      },
      {
        id: 'route-r1-manual-via-r3',
        destinationNetwork: '10.0.2.0',
        prefixLength: 24,
        nextHopIp: '10.255.2.2',
        outInterfaceId: 'router-r1-g0-2',
        type: 'manual-static',
        metric: 1,
        enabled: true,
      },
    ],
  } satisfies RouterNode
  const routerR2 = router('router-r2', 'Router R2', ['g0/0', 'g0/1'])
  const routerR3 = router('router-r3', 'Router R3', ['g0/0', 'g0/1'])
  const switchS2 = switchNode('switch-s2', 'Switch S2', [
    'e0/1',
    'e0/2',
    'e0/3',
  ])
  const hostB = host('host-b', 'Host B')

  return topologyState(
    [hostA, switchS1, routerR1, routerR2, routerR3, switchS2, hostB],
    [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
      link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
      link('link-3', endpoint(routerR1, 'g0/1'), endpoint(routerR2, 'g0/0')),
      link('link-4', endpoint(routerR1, 'g0/2'), endpoint(routerR3, 'g0/0')),
      link('link-5', endpoint(routerR2, 'g0/1'), endpoint(switchS2, 'e0/1'), 80),
      link('link-6', endpoint(routerR3, 'g0/1'), endpoint(switchS2, 'e0/2'), 120),
      link('link-7', endpoint(switchS2, 'e0/3'), endpoint(hostB, 'eth0')),
    ],
  )
}

function redundantRouterMeshTopology(): TopologyState {
  const hostA = positioned(host('host-a', 'Host A'), 40, 280)
  const routerR1 = positioned(
    {
      ...router('router-r1', 'Router R1', ['g0/0', 'g0/1', 'g0/2']),
      routingTable: [
        manualRoute(
          'route-r1-manual-via-r2',
          '10.0.2.0',
          24,
          '10.255.1.2',
          'router-r1-g0-1',
        ),
        manualRoute(
          'route-r1-manual-via-r3',
          '10.0.2.0',
          24,
          '10.255.2.2',
          'router-r1-g0-2',
        ),
      ],
    } satisfies RouterNode,
    250,
    280,
  )
  const routerR2 = positioned(
    {
      ...router('router-r2', 'Router R2', ['g0/0', 'g0/1', 'g0/2', 'g0/3']),
      routingTable: [
        manualRoute(
          'route-r2-manual-via-r4',
          '10.0.2.0',
          24,
          '10.255.3.2',
          'router-r2-g0-1',
        ),
        manualRoute(
          'route-r2-manual-via-r5',
          '10.0.2.0',
          24,
          '10.255.4.2',
          'router-r2-g0-2',
        ),
      ],
    } satisfies RouterNode,
    500,
    120,
  )
  const routerR3 = positioned(
    {
      ...router('router-r3', 'Router R3', ['g0/0', 'g0/1', 'g0/2', 'g0/3']),
      routingTable: [
        manualRoute(
          'route-r3-manual-via-r4',
          '10.0.2.0',
          24,
          '10.255.6.2',
          'router-r3-g0-1',
        ),
        manualRoute(
          'route-r3-manual-via-r5',
          '10.0.2.0',
          24,
          '10.255.7.2',
          'router-r3-g0-2',
        ),
      ],
    } satisfies RouterNode,
    500,
    440,
  )
  const routerR4 = positioned(
    {
      ...router('router-r4', 'Router R4', ['g0/0', 'g0/1', 'g0/2', 'g0/3']),
      routingTable: [
        manualRoute(
          'route-r4-manual-via-r6',
          '10.0.2.0',
          24,
          '10.255.8.2',
          'router-r4-g0-2',
        ),
      ],
    } satisfies RouterNode,
    760,
    120,
  )
  const routerR5 = positioned(
    {
      ...router('router-r5', 'Router R5', ['g0/0', 'g0/1', 'g0/2', 'g0/3']),
      routingTable: [
        manualRoute(
          'route-r5-manual-via-r6',
          '10.0.2.0',
          24,
          '10.255.10.2',
          'router-r5-g0-2',
        ),
      ],
    } satisfies RouterNode,
    760,
    440,
  )
  const routerR6 = positioned(
    router('router-r6', 'Router R6', ['g0/0', 'g0/1', 'g0/2']),
    1010,
    280,
  )
  const hostB = positioned(host('host-b', 'Host B'), 1220, 280)

  return {
    nodes: [hostA, routerR1, routerR2, routerR3, routerR4, routerR5, routerR6, hostB],
    links: [
      link('link-1', endpoint(hostA, 'eth0'), endpoint(routerR1, 'g0/0')),
      link('link-2', endpoint(routerR1, 'g0/1'), endpoint(routerR2, 'g0/0')),
      link('link-3', endpoint(routerR1, 'g0/2'), endpoint(routerR3, 'g0/0')),
      link('link-4', endpoint(routerR2, 'g0/1'), endpoint(routerR4, 'g0/0')),
      link('link-5', endpoint(routerR2, 'g0/2'), endpoint(routerR5, 'g0/0')),
      link('link-6', endpoint(routerR3, 'g0/1'), endpoint(routerR4, 'g0/1')),
      link('link-7', endpoint(routerR3, 'g0/2'), endpoint(routerR5, 'g0/1')),
      link('link-8', endpoint(routerR4, 'g0/2'), endpoint(routerR6, 'g0/0')),
      link('link-9', endpoint(routerR5, 'g0/2'), endpoint(routerR6, 'g0/1')),
      link('link-10', endpoint(routerR2, 'g0/3'), endpoint(routerR3, 'g0/3')),
      link('link-11', endpoint(routerR4, 'g0/3'), endpoint(routerR5, 'g0/3')),
      link('link-12', endpoint(routerR6, 'g0/2'), endpoint(hostB, 'eth0')),
    ],
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}

function topologyState(
  nodes: NetworkNode[],
  links: NetworkLink[],
): TopologyState {
  return {
    nodes: nodes.map((node, index) => ({
      ...node,
      position: exampleNodePosition(index),
    })),
    links,
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}

function exampleNodePosition(index: number): CanvasPosition {
  return {
    x: 80 + index * EXAMPLE_NODE_SPACING_X,
    y: EXAMPLE_NODE_Y,
  }
}

function positioned<T extends NetworkNode>(
  node: T,
  x: number,
  y: number,
): T {
  return {
    ...node,
    position: { x, y },
  }
}

function manualRoute(
  id: string,
  destinationNetwork: string,
  prefixLength: number,
  nextHopIp: string,
  outInterfaceId: InterfaceId,
): RouteEntry {
  return {
    id,
    destinationNetwork,
    prefixLength,
    nextHopIp,
    outInterfaceId,
    type: 'manual-static',
    metric: 1,
    enabled: true,
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
    macAddress: generateMac(`${nodeId}:${name}`),
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
  mtu = DEFAULT_LINK_MTU,
): NetworkLink {
  return {
    id,
    endpointA,
    endpointB,
    status: 'up',
    delayMs: 100,
    lossRate: 0,
    mtu,
  }
}

function hostPacket(
  sourceHostId: string,
  targetHostId: string,
  packetType: PacketGeneratorInput['packetType'],
): PacketGeneratorInput {
  return {
    sourceHostId,
    destinationMode: 'host',
    targetHostId,
    packetType,
    ttl: 64,
    packetCount: 1,
    intervalMs: 500,
    payload: 'Hello',
  }
}

function ipPacket(
  sourceHostId: string,
  destinationIp: string,
  ttl: number,
): PacketGeneratorInput {
  return {
    sourceHostId,
    destinationMode: 'ip-address',
    destinationIp,
    packetType: 'generic-ipv4',
    ttl,
    packetCount: 1,
    intervalMs: 500,
    payload: 'Hello',
  }
}
