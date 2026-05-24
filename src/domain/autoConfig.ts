import { broadcastAddress, hostAddressFromOffset } from './ip'
import { generateMac } from './mac'
import { applyRoutingTables } from './routing'
import { applyNetworkSegments } from './segments'
import { DEFAULT_LINK_MTU } from './types'
import type {
  HostNode,
  InterfaceId,
  LinkId,
  NetworkInterface,
  NetworkNode,
  NetworkSegment,
  RouterNode,
  TopologyState,
} from './types'

interface InterfaceOwner {
  node: NetworkNode
  networkInterface: NetworkInterface
  nodeIndex: number
}

export function applyAutoConfiguration(topology: TopologyState): TopologyState {
  const linkedTopology = syncInterfaceLinkIds({
    ...topology,
    links: topology.links.map((link) => ({
      ...link,
      mtu: link.mtu ?? DEFAULT_LINK_MTU,
    })),
  })
  const segmentedTopology = applyNetworkSegments(linkedTopology)

  if (!segmentedTopology.settings.autoConfiguration) {
    return ensureMacAddresses(segmentedTopology)
  }

  const owners = interfaceOwners(segmentedTopology.nodes)
  const assignment = buildInterfaceAssignments(segmentedTopology.segments, owners)
  const gatewayBySegment = buildGateways(segmentedTopology.segments, assignment, owners)
  const nodes = segmentedTopology.nodes.map((node) =>
    configureNode(node, assignment, gatewayBySegment),
  )

  return applyRoutingTables({
    ...segmentedTopology,
    nodes,
    segments: segmentedTopology.segments.map((segment) => ({
      ...segment,
      defaultGatewayIp: gatewayBySegment.get(segment.id)?.ipAddress,
      primaryRouterInterfaceId: gatewayBySegment.get(segment.id)?.interfaceId,
      reservedAddresses: [
        segment.networkAddress,
        broadcastAddress(segment.networkAddress, segment.prefixLength),
      ],
    })),
  })
}

function syncInterfaceLinkIds(topology: TopologyState): TopologyState {
  const linkIdsByInterface = new Map<InterfaceId, LinkId[]>()

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      linkIdsByInterface.set(networkInterface.id, [])
    }
  }

  for (const networkLink of topology.links) {
    linkIdsByInterface
      .get(networkLink.endpointA.interfaceId)
      ?.push(networkLink.id)
    linkIdsByInterface
      .get(networkLink.endpointB.interfaceId)
      ?.push(networkLink.id)
  }

  return {
    ...topology,
    nodes: topology.nodes.map((node) => ({
      ...node,
      interfaces: node.interfaces.map((networkInterface) => ({
        ...networkInterface,
        connectedLinkIds:
          linkIdsByInterface.get(networkInterface.id) ??
          networkInterface.connectedLinkIds,
      })),
    })),
  }
}

function ensureMacAddresses(topology: TopologyState): TopologyState {
  return {
    ...topology,
    nodes: topology.nodes.map((node) => ({
      ...node,
      interfaces: node.interfaces.map((networkInterface) => ({
        ...networkInterface,
        macAddress:
          networkInterface.macAddress ||
          generateMac(`${networkInterface.nodeId}:${networkInterface.name}`),
      })),
    })),
  }
}

function buildInterfaceAssignments(
  segments: NetworkSegment[],
  owners: Map<InterfaceId, InterfaceOwner>,
): Map<InterfaceId, { ipAddress: string; prefixLength: number }> {
  const assignment = new Map<
    InterfaceId,
    { ipAddress: string; prefixLength: number }
  >()

  for (const segment of segments) {
    const routerOwners = sortedOwners(segment, owners).filter(
      (owner) => owner.node.type === 'router',
    )
    const hostOwners = sortedOwners(segment, owners).filter(
      (owner) => owner.node.type === 'host',
    )

    routerOwners.forEach((owner, index) => {
      assignment.set(owner.networkInterface.id, {
        ipAddress: hostAddressFromOffset(
          segment.networkAddress,
          segment.prefixLength,
          segment.allocationPolicy.routerStartOffset + index,
        ),
        prefixLength: segment.prefixLength,
      })
    })

    hostOwners.forEach((owner, index) => {
      assignment.set(owner.networkInterface.id, {
        ipAddress: hostAddressFromOffset(
          segment.networkAddress,
          segment.prefixLength,
          segment.allocationPolicy.hostStartOffset + index,
        ),
        prefixLength: segment.prefixLength,
      })
    })
  }

  return assignment
}

function buildGateways(
  segments: NetworkSegment[],
  assignment: Map<InterfaceId, { ipAddress: string; prefixLength: number }>,
  owners: Map<InterfaceId, InterfaceOwner>,
): Map<string, { interfaceId: InterfaceId; ipAddress: string }> {
  const gatewayBySegment = new Map<
    string,
    { interfaceId: InterfaceId; ipAddress: string }
  >()

  for (const segment of segments) {
    const routerOwner = sortedOwners(segment, owners).find(
      (owner) => owner.node.type === 'router',
    )
    const routerIp = routerOwner
      ? assignment.get(routerOwner.networkInterface.id)?.ipAddress ??
        routerOwner.networkInterface.ipAddress
      : undefined

    if (routerOwner && routerIp) {
      gatewayBySegment.set(segment.id, {
        interfaceId: routerOwner.networkInterface.id,
        ipAddress: routerIp,
      })
    }
  }

  return gatewayBySegment
}

function configureNode(
  node: NetworkNode,
  assignment: Map<InterfaceId, { ipAddress: string; prefixLength: number }>,
  gatewayBySegment: Map<string, { interfaceId: InterfaceId; ipAddress: string }>,
): NetworkNode {
  const interfaces = node.interfaces.map((networkInterface) =>
    configureInterface(networkInterface, assignment),
  )

  if (node.type === 'host') {
    const segmentId = interfaces[0]?.segmentId
    const defaultGatewayIp = segmentId
      ? gatewayBySegment.get(segmentId)?.ipAddress
      : undefined

    return {
      ...node,
      interfaces,
      defaultGatewayIp,
    } satisfies HostNode
  }

  if (node.type === 'router') {
    return {
      ...node,
      interfaces,
    } satisfies RouterNode
  }

  return {
    ...node,
    interfaces,
  }
}

function configureInterface(
  networkInterface: NetworkInterface,
  assignment: Map<InterfaceId, { ipAddress: string; prefixLength: number }>,
): NetworkInterface {
  const assigned = assignment.get(networkInterface.id)

  if (networkInterface.manualOverride || !assigned) {
    return {
      ...networkInterface,
      macAddress:
        networkInterface.macAddress ||
        generateMac(`${networkInterface.nodeId}:${networkInterface.name}`),
    }
  }

  return {
    ...networkInterface,
    macAddress:
      networkInterface.macAddress ||
      generateMac(`${networkInterface.nodeId}:${networkInterface.name}`),
    ipAddress: assigned.ipAddress,
    prefixLength: assigned.prefixLength,
    autoAssigned: true,
  }
}

function interfaceOwners(nodes: NetworkNode[]): Map<InterfaceId, InterfaceOwner> {
  const owners = new Map<InterfaceId, InterfaceOwner>()

  nodes.forEach((node, nodeIndex) => {
    for (const networkInterface of node.interfaces) {
      owners.set(networkInterface.id, {
        node,
        networkInterface,
        nodeIndex,
      })
    }
  })

  return owners
}

function sortedOwners(
  segment: NetworkSegment,
  owners: Map<InterfaceId, InterfaceOwner>,
): InterfaceOwner[] {
  return segment.memberInterfaceIds
    .map((interfaceId) => owners.get(interfaceId))
    .filter((owner): owner is InterfaceOwner => Boolean(owner))
    .sort(
      (a, b) =>
        a.nodeIndex - b.nodeIndex ||
        a.networkInterface.name.localeCompare(b.networkInterface.name),
    )
}
