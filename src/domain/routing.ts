import {
  ipMatchesPrefix,
  networkAddress,
  toBinaryPrefixPattern,
} from './ip'
import type {
  InterfaceId,
  NetworkNode,
  NetworkSegment,
  RouteEntry,
  RouteLookupResult,
  RouteType,
  TopologyState,
} from './types'

interface RouterInterfaceRef {
  routerId: string
  interfaceId: InterfaceId
  ipAddress: string
  segmentId: string
}

interface RouterGraphEdge {
  toRouterId: string
  localInterfaceId: InterfaceId
  peerInterfaceIp: string
}

export function applyRoutingTables(topology: TopologyState): TopologyState {
  const connectedRoutes = generateConnectedRoutes(topology)
  const autoStaticRoutes = topology.settings.autoStaticRoutes
    ? generateAutoStaticRoutes(topology)
    : new Map<string, RouteEntry[]>()

  return {
    ...topology,
    nodes: topology.nodes.map((node) => {
      if (node.type !== 'router') {
        return node
      }

      const manualRoutes = node.routingTable.filter(
        (route) => route.type === 'manual-static' || route.type === 'default',
      )

      return {
        ...node,
        routingTable: [
          ...(connectedRoutes.get(node.id) ?? []),
          ...manualRoutes,
          ...(autoStaticRoutes.get(node.id) ?? []),
        ],
      }
    }),
  }
}

export function generateConnectedRoutes(
  topology: TopologyState,
): Map<string, RouteEntry[]> {
  const routesByRouter = new Map<string, RouteEntry[]>()

  for (const node of topology.nodes) {
    if (node.type !== 'router') {
      continue
    }

    const routes = node.interfaces
      .filter(
        (networkInterface) =>
          networkInterface.ipAddress && networkInterface.prefixLength !== undefined,
      )
      .map((networkInterface): RouteEntry => {
        const prefixLength = networkInterface.prefixLength ?? 0

        return {
          id: `route-${node.id}-connected-${networkInterface.id}`,
          destinationNetwork: networkAddress(
            networkInterface.ipAddress ?? '0.0.0.0',
            prefixLength,
          ),
          prefixLength,
          outInterfaceId: networkInterface.id,
          type: 'connected',
          enabled: true,
          generatedBy: 'connected-route-generator',
        }
      })

    routesByRouter.set(node.id, routes)
  }

  return routesByRouter
}

export function generateAutoStaticRoutes(
  topology: TopologyState,
): Map<string, RouteEntry[]> {
  const routesByRouter = new Map<string, RouteEntry[]>()
  const routerInterfaces = routerInterfaceRefs(topology.nodes)
  const routerGraph = buildRouterGraph(topology.segments, routerInterfaces)

  for (const router of topology.nodes.filter((node) => node.type === 'router')) {
    const connectedSegmentIds = new Set(
      router.interfaces
        .map((networkInterface) => networkInterface.segmentId)
        .filter((segmentId): segmentId is string => Boolean(segmentId)),
    )
    const routes: RouteEntry[] = []

    for (const segment of topology.segments) {
      if (connectedSegmentIds.has(segment.id)) {
        continue
      }

      const targetRouters = routersConnectedToSegment(segment.id, routerInterfaces)
      const firstHopEdges = reachableFirstHopEdges(
        router.id,
        targetRouters,
        routerGraph,
      )

      for (const edge of firstHopEdges) {
        routes.push({
          id: `route-${router.id}-auto-${segment.id}-${edge.localInterfaceId}`,
          destinationNetwork: segment.networkAddress,
          prefixLength: segment.prefixLength,
          nextHopIp: edge.peerInterfaceIp,
          outInterfaceId: edge.localInterfaceId,
          type: 'auto-static',
          metric: 1,
          enabled: true,
          generatedBy: 'auto-route-assistant',
        })
      }
    }

    routesByRouter.set(router.id, sortRoutes(routes))
  }

  return routesByRouter
}

export function lookupRoute(
  dstIp: string,
  routes: RouteEntry[],
  options: { random?: () => number; excludedOutInterfaceId?: InterfaceId } = {},
): RouteLookupResult {
  const candidates = routes
    .filter((route) => route.enabled)
    .map((route) => {
      const matched = ipMatchesPrefix(
        dstIp,
        route.destinationNetwork,
        route.prefixLength,
      )

      return {
        route,
        matched,
        matchLength: matched ? route.prefixLength : 0,
        binaryPattern: toBinaryPrefixPattern(
          route.destinationNetwork,
          route.prefixLength,
        ),
      }
    })
  const matchedCandidates = candidates
    .filter((candidate) => candidate.matched)
    .map((candidate, index) => ({ ...candidate, index }))
    .sort((a, b) => compareRouteEntries(a.route, b.route) || a.index - b.index)
  const selectableMatchedCandidates = options.excludedOutInterfaceId
    ? matchedCandidates.filter(
        (candidate) =>
          candidate.route.outInterfaceId !== options.excludedOutInterfaceId,
      )
    : matchedCandidates

  if (selectableMatchedCandidates.length === 0) {
    return { candidates, reason: 'no-match' }
  }

  const bestCandidates = selectableMatchedCandidates.filter(
    (candidate) =>
      compareRouteEntries(
        candidate.route,
        selectableMatchedCandidates[0].route,
      ) === 0,
  )
  const selectedIndex = randomCandidateIndex(
    bestCandidates.length,
    options.random ?? Math.random,
  )

  return {
    selectedRoute: bestCandidates[selectedIndex]?.route ?? bestCandidates[0].route,
    candidates,
    reason: 'longest-prefix-match',
  }
}

function randomCandidateIndex(candidateCount: number, random: () => number): number {
  if (candidateCount <= 1) {
    return 0
  }

  const value = random()

  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(
    candidateCount - 1,
    Math.max(0, Math.floor(value * candidateCount)),
  )
}

function compareRouteEntries(a: RouteEntry, b: RouteEntry): number {
  return (
    b.prefixLength - a.prefixLength ||
    routeTypePrecedence(a.type) - routeTypePrecedence(b.type) ||
    (a.metric ?? Number.MAX_SAFE_INTEGER) -
      (b.metric ?? Number.MAX_SAFE_INTEGER)
  )
}

function routeTypePrecedence(type: RouteType): number {
  if (type === 'connected') {
    return 0
  }

  if (type === 'manual-static') {
    return 1
  }

  if (type === 'auto-static') {
    return 2
  }

  return 3
}

function routerInterfaceRefs(nodes: NetworkNode[]): RouterInterfaceRef[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'router') {
      return []
    }

    return node.interfaces
      .filter(
        (networkInterface) =>
          networkInterface.ipAddress && networkInterface.segmentId,
      )
      .map((networkInterface) => ({
        routerId: node.id,
        interfaceId: networkInterface.id,
        ipAddress: networkInterface.ipAddress ?? '',
        segmentId: networkInterface.segmentId ?? '',
      }))
  })
}

function buildRouterGraph(
  segments: NetworkSegment[],
  routerInterfaces: RouterInterfaceRef[],
): Map<string, RouterGraphEdge[]> {
  const graph = new Map<string, RouterGraphEdge[]>()

  for (const segment of segments) {
    const routersInSegment = routerInterfaces.filter(
      (routerInterface) => routerInterface.segmentId === segment.id,
    )

    for (const local of routersInSegment) {
      for (const peer of routersInSegment) {
        if (local.routerId === peer.routerId) {
          continue
        }

        const edges = graph.get(local.routerId) ?? []
        edges.push({
          toRouterId: peer.routerId,
          localInterfaceId: local.interfaceId,
          peerInterfaceIp: peer.ipAddress,
        })
        graph.set(local.routerId, edges)
      }
    }
  }

  return graph
}

function routersConnectedToSegment(
  segmentId: string,
  routerInterfaces: RouterInterfaceRef[],
): Set<string> {
  return new Set(
    routerInterfaces
      .filter((routerInterface) => routerInterface.segmentId === segmentId)
      .map((routerInterface) => routerInterface.routerId),
  )
}

function reachableFirstHopEdges(
  startRouterId: string,
  targetRouterIds: Set<string>,
  graph: Map<string, RouterGraphEdge[]>,
): RouterGraphEdge[] {
  return (graph.get(startRouterId) ?? []).filter((edge) =>
    canReachAnyRouter(edge.toRouterId, targetRouterIds, graph, startRouterId),
  )
}

function canReachAnyRouter(
  startRouterId: string,
  targetRouterIds: Set<string>,
  graph: Map<string, RouterGraphEdge[]>,
  blockedRouterId: string,
): boolean {
  const queue = [startRouterId]
  const visited = new Set([blockedRouterId])

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    if (targetRouterIds.has(current)) {
      return true
    }

    visited.add(current)

    for (const edge of graph.get(current) ?? []) {
      if (!visited.has(edge.toRouterId)) {
        queue.push(edge.toRouterId)
      }
    }
  }

  return false
}

function sortRoutes(routes: RouteEntry[]): RouteEntry[] {
  return [...routes].sort(
    (a, b) =>
      a.destinationNetwork.localeCompare(b.destinationNetwork) ||
      b.prefixLength - a.prefixLength ||
      (a.metric ?? Number.MAX_SAFE_INTEGER) -
        (b.metric ?? Number.MAX_SAFE_INTEGER) ||
      a.outInterfaceId.localeCompare(b.outInterfaceId),
  )
}
