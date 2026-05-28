import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { lookupRoute } from '../domain/routing'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type InterfaceId,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type RouteEntry,
  type RouterNode,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'

describe('Routing table generation', () => {
  test('generates connected routes for one router with two LANs', () => {
    const configured = applyAutoConfiguration(firstMilestoneTopology())
    const routerR1 = routerById(configured, 'router-r1')

    expect(routerR1.routingTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: '10.0.1.0',
          prefixLength: 24,
          outInterfaceId: 'router-r1-g0-0',
          type: 'connected',
        }),
        expect.objectContaining({
          destinationNetwork: '10.0.2.0',
          prefixLength: 24,
          outInterfaceId: 'router-r1-g0-1',
          type: 'connected',
        }),
      ]),
    )
  })

  test('generates auto static routes across a point-to-point router link', () => {
    const configured = applyAutoConfiguration(twoRouterTopology())
    const routerR1 = routerById(configured, 'router-r1')
    const routerR2 = routerById(configured, 'router-r2')

    expect(routerR1.routingTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: '10.0.2.0',
          prefixLength: 24,
          nextHopIp: '10.255.1.2',
          outInterfaceId: 'router-r1-g0-1',
          type: 'auto-static',
        }),
      ]),
    )
    expect(routerR2.routingTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: '10.0.1.0',
          prefixLength: 24,
          nextHopIp: '10.255.1.1',
          outInterfaceId: 'router-r2-g0-0',
          type: 'auto-static',
        }),
      ]),
    )
    expect(routerR1.routingTable).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: '10.255.1.0',
          prefixLength: 30,
          type: 'connected',
        }),
      ]),
    )
  })

  test('generates equal-metric auto routes through forwarding router interfaces', () => {
    const configured = applyAutoConfiguration(routerMeshTopology())
    const routerR6 = routerById(configured, 'router-r6')
    const hostCSegment = segmentContaining(configured, 'host-c-eth0')
    const r6RoutesToHostC = routerR6.routingTable.filter(
      (route) =>
        route.type === 'auto-static' &&
        route.destinationNetwork === hostCSegment.networkAddress &&
        route.prefixLength === hostCSegment.prefixLength,
    )

    expect(r6RoutesToHostC.map((route) => route.outInterfaceId)).toEqual([
      'router-r6-g0-0',
      'router-r6-g0-1',
    ])
    expect(r6RoutesToHostC.map((route) => route.metric)).toEqual([2, 2])
  })

  test('does not generate auto static routes through routers farther from the destination', () => {
    const configured = applyAutoConfiguration(sharedTransitRouterTopology())
    const routerR2 = routerById(configured, 'router-r2')
    const routerR3 = routerById(configured, 'router-r3')
    const hostBSegment = segmentContaining(configured, 'host-b-eth0')
    const routesToHostB = (router: RouterNode) =>
      router.routingTable.filter(
        (route) =>
          route.type === 'auto-static' &&
          route.destinationNetwork === hostBSegment.networkAddress &&
          route.prefixLength === hostBSegment.prefixLength,
      )

    expect(routesToHostB(routerR2).map((route) => route.nextHopIp)).toEqual([
      '10.0.1.2',
      '10.0.1.3',
      '10.0.1.4',
    ])
    expect(routesToHostB(routerR3).map((route) => route.nextHopIp)).not.toContain(
      '10.0.1.1',
    )
    expect(routesToHostB(routerR3)).toEqual([
      expect.objectContaining({
        nextHopIp: '10.255.2.2',
        outInterfaceId: 'router-r3-g0-1',
        metric: 1,
      }),
    ])
  })

  test('keeps generated routes limited to Host-containing segments', () => {
    const configured = applyAutoConfiguration(sharedTransitRouterTopology())
    const routerR1 = routerById(configured, 'router-r1')
    const routerR2 = routerById(configured, 'router-r2')
    const routerOnlyNetworks = new Set(['10.0.1.0', '10.255.1.0'])

    for (const router of [routerR1, routerR2]) {
      expect(
        router.routingTable
          .filter(
            (route) =>
              route.type === 'connected' || route.type === 'auto-static',
          )
          .some((route) => routerOnlyNetworks.has(route.destinationNetwork)),
      ).toBe(false)
    }
    expect(routerR2.routingTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: '10.0.2.0',
          prefixLength: 24,
          type: 'auto-static',
        }),
      ]),
    )
  })
})

describe('Longest Prefix Match', () => {
  test('selects the most specific matching route', () => {
    const result = lookupRoute('10.0.2.10', [
      route('default', '0.0.0.0', 0, 'default'),
      route('broad', '10.0.0.0', 8, 'manual-static'),
      route('specific', '10.0.2.0', 24, 'auto-static'),
    ])

    expect(result.reason).toBe('longest-prefix-match')
    expect(result.selectedRoute?.id).toBe('specific')
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchLength: 24,
          binaryPattern: '00001010.00000000.00000010.xxxxxxxx',
        }),
      ]),
    )
  })

  test('uses route type precedence for equal prefix length conflicts', () => {
    const result = lookupRoute('10.0.2.10', [
      route('auto', '10.0.2.0', 24, 'auto-static'),
      route('manual', '10.0.2.0', 24, 'manual-static'),
      route('connected', '10.0.2.0', 24, 'connected'),
    ])

    expect(result.selectedRoute?.id).toBe('connected')
  })

  test('randomly selects across equal best routes', () => {
    const routes = [
      route('path-a', '10.0.2.0', 24, 'manual-static'),
      route('path-b', '10.0.2.0', 24, 'manual-static'),
    ]

    expect(
      lookupRoute('10.0.2.10', routes, { random: () => 0 }).selectedRoute?.id,
    ).toBe('path-a')
    expect(
      lookupRoute('10.0.2.10', routes, { random: () => 0.99 }).selectedRoute?.id,
    ).toBe('path-b')
    expect(
      lookupRoute('10.0.2.10', routes, { random: () => Number.NaN })
        .selectedRoute?.id,
    ).toBe('path-a')
  })

  test('excludes the ingress interface from equal best route selection', () => {
    const routes = [
      route('backtrack', '10.0.2.0', 24, 'manual-static'),
      route('alternate', '10.0.2.0', 24, 'manual-static'),
    ]
    routes[0].outInterfaceId = 'router-r1-g0-0'
    routes[1].outInterfaceId = 'router-r1-g0-1'

    expect(
      lookupRoute('10.0.2.10', routes, {
        excludedOutInterfaceId: 'router-r1-g0-0',
        random: () => 0,
      }).selectedRoute?.id,
    ).toBe('alternate')
  })

  test('does not select a route when every equal best route uses the ingress interface', () => {
    const routes = [route('backtrack', '10.0.2.0', 24, 'manual-static')]

    routes[0].outInterfaceId = 'router-r1-g0-0'

    const result = lookupRoute('10.0.2.10', routes, {
      excludedOutInterfaceId: 'router-r1-g0-0',
      random: () => 0,
    })

    expect(result.reason).toBe('no-match')
    expect(result.selectedRoute).toBeUndefined()
  })

  test('uses the next eligible route when the highest-priority route uses the ingress interface', () => {
    const routes = [
      route('manual-backtrack', '10.0.2.0', 24, 'manual-static'),
      route('auto-alternate', '10.0.2.0', 24, 'auto-static'),
    ]
    routes[0].outInterfaceId = 'router-r1-g0-0'
    routes[1].outInterfaceId = 'router-r1-g0-1'

    expect(
      lookupRoute('10.0.2.10', routes, {
        excludedOutInterfaceId: 'router-r1-g0-0',
        random: () => 0,
      }).selectedRoute?.id,
    ).toBe('auto-alternate')
  })

  test('returns no-match when no enabled route matches', () => {
    const result = lookupRoute('203.0.113.10', [
      route('lan', '10.0.2.0', 24, 'connected'),
    ])

    expect(result.reason).toBe('no-match')
    expect(result.selectedRoute).toBeUndefined()
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

function routerMeshTopology(): TopologyState {
  const routerR6 = router('router-r6', 'Router R6', [
    'g0/0',
    'g0/1',
    'g0/2',
  ])
  const routerR5 = router('router-r5', 'Router R5', [
    'g0/0',
    'g0/1',
    'g0/2',
  ])
  const routerR7 = router('router-r7', 'Router R7', [
    'g0/0',
    'g0/1',
    'g0/2',
  ])
  const routerR4 = router('router-r4', 'Router R4', [
    'g0/0',
    'g0/1',
    'g0/2',
  ])
  const routerR8 = router('router-r8', 'Router R8', [
    'g0/0',
    'g0/1',
    'g0/2',
  ])
  const hostC = host('host-c', 'Host C')

  return topologyState(
    [routerR6, routerR5, routerR7, routerR4, routerR8, hostC],
    [
      link('link-1', endpoint(routerR6, 'g0/0'), endpoint(routerR5, 'g0/0')),
      link('link-2', endpoint(routerR6, 'g0/1'), endpoint(routerR7, 'g0/0')),
      link('link-3', endpoint(routerR6, 'g0/2'), endpoint(routerR4, 'g0/0')),
      link('link-4', endpoint(routerR4, 'g0/1'), endpoint(routerR5, 'g0/1')),
      link('link-5', endpoint(routerR4, 'g0/2'), endpoint(routerR7, 'g0/1')),
      link('link-6', endpoint(routerR5, 'g0/2'), endpoint(routerR8, 'g0/0')),
      link('link-7', endpoint(routerR7, 'g0/2'), endpoint(routerR8, 'g0/1')),
      link('link-8', endpoint(routerR8, 'g0/2'), endpoint(hostC, 'eth0')),
    ],
  )
}

function sharedTransitRouterTopology(): TopologyState {
  const routerR2 = router('router-r2', 'Router R2', ['g0/0'])
  const routerR1 = router('router-r1', 'Router R1', ['g0/0', 'g0/1'])
  const routerR3 = router('router-r3', 'Router R3', ['g0/0', 'g0/1'])
  const routerR4 = router('router-r4', 'Router R4', ['g0/0', 'g0/1'])
  const routerR5 = router('router-r5', 'Router R5', [
    'g0/0',
    'g0/1',
    'g0/2',
    'g0/3',
  ])
  const switchS2 = switchNode('switch-s2', 'Switch S2', [
    'e0/1',
    'e0/2',
    'e0/3',
    'e0/4',
  ])
  const hostB = host('host-b', 'Host B')

  return topologyState(
    [routerR2, routerR1, routerR3, routerR4, routerR5, switchS2, hostB],
    [
      link('link-1', endpoint(routerR2, 'g0/0'), endpoint(switchS2, 'e0/1')),
      link('link-2', endpoint(routerR1, 'g0/0'), endpoint(switchS2, 'e0/2')),
      link('link-3', endpoint(routerR3, 'g0/0'), endpoint(switchS2, 'e0/3')),
      link('link-4', endpoint(routerR4, 'g0/0'), endpoint(switchS2, 'e0/4')),
      link('link-5', endpoint(routerR1, 'g0/1'), endpoint(routerR5, 'g0/0')),
      link('link-6', endpoint(routerR3, 'g0/1'), endpoint(routerR5, 'g0/1')),
      link('link-7', endpoint(routerR4, 'g0/1'), endpoint(routerR5, 'g0/2')),
      link('link-8', endpoint(routerR5, 'g0/3'), endpoint(hostB, 'eth0')),
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
    mtu: 1500,
  }
}

function route(
  id: string,
  destinationNetwork: string,
  prefixLength: number,
  type: RouteEntry['type'],
): RouteEntry {
  return {
    id,
    destinationNetwork,
    prefixLength,
    outInterfaceId: 'router-r1-g0-0',
    type,
    enabled: true,
  }
}

function routerById(topology: TopologyState, nodeId: string): RouterNode {
  const node = topology.nodes.find((candidate) => candidate.id === nodeId)

  if (!node || node.type !== 'router') {
    throw new Error(`Missing router ${nodeId}`)
  }

  return node
}

function segmentContaining(
  topology: TopologyState,
  interfaceIdToFind: InterfaceId,
) {
  const segment = topology.segments.find((candidate) =>
    candidate.memberInterfaceIds.includes(interfaceIdToFind),
  )

  if (!segment) {
    throw new Error(`Missing segment containing ${interfaceIdToFind}`)
  }

  return segment
}
