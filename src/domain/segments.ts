import { broadcastAddress } from './ip'
import {
  LAN_ALLOCATION_POLICY,
  type InterfaceId,
  type NetworkLink,
  type NetworkNode,
  type NetworkSegment,
  type SegmentType,
  type TopologyState,
} from './types'
import { UndirectedGraph } from './graph'

interface SegmentDraft {
  memberInterfaceIds: InterfaceId[]
  type: SegmentType
}

interface InterfaceOwner {
  node: NetworkNode
  nodeIndex: number
}

export function detectNetworkSegments(
  nodes: NetworkNode[],
  links: NetworkLink[],
  previousSegments: NetworkSegment[] = [],
): NetworkSegment[] {
  const owners = interfaceOwners(nodes)
  const graph = new UndirectedGraph<InterfaceId>()

  for (const interfaceId of owners.keys()) {
    graph.addVertex(interfaceId)
  }

  for (const link of links) {
    if (link.status === 'up') {
      graph.addEdge(link.endpointA.interfaceId, link.endpointB.interfaceId)
    }
  }

  for (const node of nodes) {
    if (node.type !== 'switch') {
      continue
    }

    for (let index = 1; index < node.interfaces.length; index += 1) {
      graph.addEdge(node.interfaces[0].id, node.interfaces[index].id)
    }
  }

  const drafts = graph
    .connectedComponents()
    .map((component) => createSegmentDraft(component, owners))
    .sort((a, b) => compareSegmentDrafts(a, b, owners))

  return materializeSegments(drafts, previousSegments)
}

export function applyNetworkSegments(topology: TopologyState): TopologyState {
  const segments = detectNetworkSegments(
    topology.nodes,
    topology.links,
    topology.segments,
  )
  const interfaceToSegment = new Map<InterfaceId, string>()

  for (const segment of segments) {
    for (const interfaceId of segment.memberInterfaceIds) {
      interfaceToSegment.set(interfaceId, segment.id)
    }
  }

  return {
    ...topology,
    segments,
    nodes: topology.nodes.map((node) => ({
      ...node,
      interfaces: node.interfaces.map((networkInterface) => ({
        ...networkInterface,
        segmentId: interfaceToSegment.get(networkInterface.id),
      })),
    })),
  }
}

function interfaceOwners(nodes: NetworkNode[]): Map<InterfaceId, InterfaceOwner> {
  const owners = new Map<InterfaceId, InterfaceOwner>()

  nodes.forEach((node, nodeIndex) => {
    for (const networkInterface of node.interfaces) {
      owners.set(networkInterface.id, { node, nodeIndex })
    }
  })

  return owners
}

function createSegmentDraft(
  memberInterfaceIds: InterfaceId[],
  owners: Map<InterfaceId, InterfaceOwner>,
): SegmentDraft {
  const sortedMembers = [...memberInterfaceIds].sort()
  const memberNodes = sortedMembers
    .map((interfaceId) => owners.get(interfaceId)?.node)
    .filter((node): node is NetworkNode => Boolean(node))
  const type =
    sortedMembers.length === 2 &&
    memberNodes.every((node) => node.type === 'router')
      ? 'point-to-point'
      : 'lan'

  return {
    memberInterfaceIds: sortedMembers,
    type,
  }
}

function compareSegmentDrafts(
  a: SegmentDraft,
  b: SegmentDraft,
  owners: Map<InterfaceId, InterfaceOwner>,
): number {
  const aRank = segmentRank(a, owners)
  const bRank = segmentRank(b, owners)

  return aRank - bRank || a.memberInterfaceIds.join('|').localeCompare(b.memberInterfaceIds.join('|'))
}

function segmentRank(
  draft: SegmentDraft,
  owners: Map<InterfaceId, InterfaceOwner>,
): number {
  return Math.min(
    ...draft.memberInterfaceIds.map(
      (interfaceId) => owners.get(interfaceId)?.nodeIndex ?? Number.MAX_SAFE_INTEGER,
    ),
  )
}

function materializeSegments(
  drafts: SegmentDraft[],
  previousSegments: NetworkSegment[],
): NetworkSegment[] {
  const usedPreviousIds = new Set<string>()
  let lanIndex = 0
  let pointToPointIndex = 0

  return drafts.map((draft) => {
    if (draft.type === 'point-to-point') {
      pointToPointIndex += 1
    } else {
      lanIndex += 1
    }

    const matched = findPreviousSegment(
      draft,
      previousSegments,
      usedPreviousIds,
    )

    if (matched) {
      usedPreviousIds.add(matched.id)

      return {
        ...matched,
        type: draft.type,
        memberInterfaceIds: draft.memberInterfaceIds,
      }
    }

    const index = draft.type === 'point-to-point' ? pointToPointIndex : lanIndex
    const networkAddress =
      draft.type === 'point-to-point'
        ? `10.255.${index}.0`
        : `10.0.${index}.0`
    const prefixLength = draft.type === 'point-to-point' ? 30 : 24

    return {
      id: segmentId(draft.memberInterfaceIds),
      name: draft.type === 'point-to-point' ? `P2P-${index}` : `LAN-${index}`,
      type: draft.type,
      networkAddress,
      prefixLength,
      memberInterfaceIds: draft.memberInterfaceIds,
      allocationPolicy: LAN_ALLOCATION_POLICY,
      reservedAddresses: [
        networkAddress,
        broadcastAddress(networkAddress, prefixLength),
      ],
      autoAssigned: true,
      manualOverride: false,
    }
  })
}

function findPreviousSegment(
  draft: SegmentDraft,
  previousSegments: NetworkSegment[],
  usedPreviousIds: Set<string>,
): NetworkSegment | undefined {
  let bestMatch: NetworkSegment | undefined
  let bestOverlap = 0
  const draftMembers = new Set(draft.memberInterfaceIds)

  for (const segment of previousSegments) {
    if (usedPreviousIds.has(segment.id)) {
      continue
    }

    const overlap = segment.memberInterfaceIds.filter((interfaceId) =>
      draftMembers.has(interfaceId),
    ).length

    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestMatch = segment
    }
  }

  if (!bestMatch) {
    return undefined
  }

  const overlapRatio =
    bestOverlap /
    Math.max(bestMatch.memberInterfaceIds.length, draft.memberInterfaceIds.length)

  return overlapRatio >= 0.5 ? bestMatch : undefined
}

function segmentId(memberInterfaceIds: InterfaceId[]): string {
  let hash = 0x811c9dc5
  const input = memberInterfaceIds.join('|')

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return `segment-${hash.toString(16)}`
}
