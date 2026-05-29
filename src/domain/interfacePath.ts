import type {
  InterfaceId,
  LinkId,
  NetworkInterface,
  SegmentId,
  TopologyState,
} from './types'

interface InterfacePath {
  pathInterfaceIds: InterfaceId[]
  pathLinkIds: LinkId[]
}

interface AdjacencyEntry {
  interfaceId: InterfaceId
  linkId?: LinkId
}

interface InterfaceById {
  interfacesById: Map<InterfaceId, NetworkInterface>
}

export function findInterfacePath(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): InterfacePath | undefined {
  const { interfacesById } = buildInterfaceIndex(topology)
  const sourceInterface = interfacesById.get(sourceInterfaceId)
  const targetInterface = interfacesById.get(targetInterfaceId)

  if (
    !sourceInterface ||
    !targetInterface ||
    sourceInterface.segmentId !== segmentId ||
    targetInterface.segmentId !== segmentId
  ) {
    return undefined
  }

  const adjacency = buildSegmentAdjacency(topology, interfacesById, segmentId)
  const visited = new Set<InterfaceId>([sourceInterfaceId])
  const queue: Array<{
    interfaceId: InterfaceId
    pathInterfaceIds: InterfaceId[]
    pathLinkIds: LinkId[]
  }> = [
    {
      interfaceId: sourceInterfaceId,
      pathInterfaceIds: [sourceInterfaceId],
      pathLinkIds: [],
    },
  ]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      break
    }

    if (current.interfaceId === targetInterfaceId) {
      return {
        pathInterfaceIds: current.pathInterfaceIds,
        pathLinkIds: current.pathLinkIds,
      }
    }

    for (const adjacent of adjacency.get(current.interfaceId) ?? []) {
      if (visited.has(adjacent.interfaceId)) {
        continue
      }

      visited.add(adjacent.interfaceId)
      queue.push({
        interfaceId: adjacent.interfaceId,
        pathInterfaceIds: [...current.pathInterfaceIds, adjacent.interfaceId],
        pathLinkIds: adjacent.linkId
          ? [...current.pathLinkIds, adjacent.linkId]
          : current.pathLinkIds,
      })
    }
  }

  return undefined
}

export function findInterfacePathInterfaceIds(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): InterfaceId[] | undefined {
  return findInterfacePath(
    topology,
    sourceInterfaceId,
    targetInterfaceId,
    segmentId,
  )?.pathInterfaceIds
}

export function findInterfacePathLinkIds(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): LinkId[] | undefined {
  return findInterfacePath(
    topology,
    sourceInterfaceId,
    targetInterfaceId,
    segmentId,
  )?.pathLinkIds
}

function buildInterfaceIndex(topology: TopologyState): InterfaceById {
  const interfacesById = new Map<InterfaceId, NetworkInterface>()

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      interfacesById.set(networkInterface.id, networkInterface)
    }
  }

  return { interfacesById }
}

function buildSegmentAdjacency(
  topology: TopologyState,
  interfacesById: Map<InterfaceId, NetworkInterface>,
  segmentId: SegmentId,
): Map<InterfaceId, AdjacencyEntry[]> {
  const adjacency = new Map<InterfaceId, AdjacencyEntry[]>()
  const addEdge = (
    fromInterfaceId: InterfaceId,
    toInterfaceId: InterfaceId,
    linkId?: LinkId,
  ) => {
    adjacency.set(fromInterfaceId, [
      ...(adjacency.get(fromInterfaceId) ?? []),
      { interfaceId: toInterfaceId, linkId },
    ])
  }

  for (const networkLink of topology.links) {
    const endpointA = interfacesById.get(networkLink.endpointA.interfaceId)
    const endpointB = interfacesById.get(networkLink.endpointB.interfaceId)

    if (
      endpointA?.segmentId === segmentId &&
      endpointB?.segmentId === segmentId
    ) {
      addEdge(endpointA.id, endpointB.id, networkLink.id)
      addEdge(endpointB.id, endpointA.id, networkLink.id)
    }
  }

  for (const switchNode of topology.nodes.filter((node) => node.type === 'switch')) {
    const segmentInterfaces = switchNode.interfaces.filter(
      (networkInterface) => networkInterface.segmentId === segmentId,
    )

    for (const fromInterface of segmentInterfaces) {
      for (const toInterface of segmentInterfaces) {
        if (fromInterface.id !== toInterface.id) {
          addEdge(fromInterface.id, toInterface.id)
        }
      }
    }
  }

  return adjacency
}
