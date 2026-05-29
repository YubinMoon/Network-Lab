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
import { collectInterfaceOwnerMap } from './interfaceIndex'

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
  const owners = collectInterfaceOwnerMap(nodes, (node, _networkInterface, nodeIndex) => ({
    node,
    nodeIndex,
  }))
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
  const usedCidrs = new Set<string>()
  const nextIndexes: Record<SegmentType, number> = {
    lan: 1,
    'point-to-point': 1,
  }

  return drafts.map((draft) => {
    const matched = findPreviousSegment(
      draft,
      previousSegments,
      usedPreviousIds,
    )

    if (matched) {
      usedPreviousIds.add(matched.id)

      if (!usedCidrs.has(cidrKey(matched))) {
        usedCidrs.add(cidrKey(matched))

        return {
          ...matched,
          type: draft.type,
          memberInterfaceIds: draft.memberInterfaceIds,
        }
      }
    }

    const allocation = nextSegmentAllocation(draft.type, nextIndexes, usedCidrs)

    return {
      id: segmentId(draft.memberInterfaceIds),
      name:
        draft.type === 'point-to-point'
          ? `P2P-${allocation.index}`
          : `LAN-${allocation.index}`,
      type: draft.type,
      networkAddress: allocation.networkAddress,
      prefixLength: allocation.prefixLength,
      memberInterfaceIds: draft.memberInterfaceIds,
      allocationPolicy: LAN_ALLOCATION_POLICY,
      reservedAddresses: [
        allocation.networkAddress,
        broadcastAddress(allocation.networkAddress, allocation.prefixLength),
      ],
      autoAssigned: true,
      manualOverride: false,
    }
  })
}

function nextSegmentAllocation(
  type: SegmentType,
  nextIndexes: Record<SegmentType, number>,
  usedCidrs: Set<string>,
): { index: number; networkAddress: string; prefixLength: number } {
  const prefixLength = type === 'point-to-point' ? 30 : 24

  while (true) {
    const index = nextIndexes[type]
    const networkAddress =
      type === 'point-to-point' ? `10.255.${index}.0` : `10.0.${index}.0`
    const key = `${networkAddress}/${prefixLength}`

    nextIndexes[type] += 1

    if (!usedCidrs.has(key)) {
      usedCidrs.add(key)

      return { index, networkAddress, prefixLength }
    }
  }
}

function cidrKey(segment: NetworkSegment): string {
  return `${segment.networkAddress}/${segment.prefixLength}`
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
    if (usedPreviousIds.has(segment.id) || segment.type !== draft.type) {
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
