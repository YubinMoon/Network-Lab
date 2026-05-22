import type {
  InterfaceId,
  LinkId,
  NetworkInterface,
  NetworkLink,
  NetworkNode,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'

export type LinkAnimationDirection = 'source-to-target' | 'target-to-source'

interface LocatedInterface {
  node: NetworkNode
  networkInterface: NetworkInterface
}

interface AnimationContext {
  interfacesById: Map<InterfaceId, LocatedInterface>
  linksByInterfaceId: Map<InterfaceId, NetworkLink[]>
}

export function linkAnimationsForEvent(
  topology: TopologyState,
  event: SimulationEvent | undefined,
): Map<LinkId, LinkAnimationDirection> {
  const animations = new Map<LinkId, LinkAnimationDirection>()

  if (!event) {
    return animations
  }

  const context = buildAnimationContext(topology)
  const addPhysicalMovement = (
    fromInterfaceId: InterfaceId | undefined,
    toInterfaceId: InterfaceId | undefined,
  ) => {
    if (!fromInterfaceId || !toInterfaceId) {
      return
    }

    const link = linkBetweenInterfaces(topology.links, fromInterfaceId, toInterfaceId)

    if (!link) {
      return
    }

    animations.set(link.id, directionForLink(link, fromInterfaceId, toInterfaceId))
  }
  const addPathMovement = (
    fromInterfaceId: InterfaceId | undefined,
    toInterfaceId: InterfaceId | undefined,
  ) => {
    if (!fromInterfaceId || !toInterfaceId) {
      return
    }

    const path = interfacePath(context, fromInterfaceId, toInterfaceId)

    for (let index = 1; index < path.length; index += 1) {
      addPhysicalMovement(path[index - 1], path[index])
    }
  }
  const addOutboundMovement = (fromInterfaceId: InterfaceId | undefined) => {
    if (!fromInterfaceId) {
      return
    }

    for (const link of context.linksByInterfaceId.get(fromInterfaceId) ?? []) {
      const peerInterfaceId = peerInterfaceIdForLink(link, fromInterfaceId)
      addPhysicalMovement(fromInterfaceId, peerInterfaceId)
    }
  }
  const addInboundMovement = (toInterfaceId: InterfaceId | undefined) => {
    if (!toInterfaceId) {
      return
    }

    for (const link of context.linksByInterfaceId.get(toInterfaceId) ?? []) {
      const peerInterfaceId = peerInterfaceIdForLink(link, toInterfaceId)
      addPhysicalMovement(peerInterfaceId, toInterfaceId)
    }
  }

  if (
    event.type === 'switch-frame-received' ||
    event.type === 'switch-source-mac-learned'
  ) {
    const ingressInterfaceId = stringDetail(event.details, 'ingressInterfaceId')
    const sourceInterfaceId = stringDetail(event.details, 'sourceInterfaceId')

    if (sourceInterfaceId) {
      addPathMovement(sourceInterfaceId, ingressInterfaceId)
    } else {
      addInboundMovement(ingressInterfaceId)
    }

    return animations
  }

  if (
    event.type === 'switch-broadcast-flooded' ||
    event.type === 'switch-unknown-unicast-flooded' ||
    event.type === 'switch-known-unicast-forwarded'
  ) {
    for (const egressInterfaceId of stringArrayDetail(event.details, 'egressInterfaceIds')) {
      addOutboundMovement(egressInterfaceId)
    }

    return animations
  }

  if (
    event.type === 'router-frame-received' ||
    event.type === 'router-frame-decapsulated'
  ) {
    addInboundMovement(stringDetail(event.details, 'ingressInterfaceId'))
    return animations
  }

  if (event.type === 'packet-forwarded') {
    addOutboundMovement(stringDetail(event.details, 'outInterfaceId'))
    return animations
  }

  if (event.type === 'packet-delivered') {
    const sourceInterfaceId = stringDetail(event.details, 'sourceInterfaceId')
    const deliveredInterfaceId = stringDetail(event.details, 'deliveredInterfaceId')

    if (sourceInterfaceId) {
      addPathMovement(sourceInterfaceId, deliveredInterfaceId)
    } else {
      addInboundMovement(deliveredInterfaceId)
    }

    return animations
  }

  if (event.type === 'arp-request-sent') {
    const sourceInterfaceId =
      stringDetail(event.details, 'sourceInterfaceId') ??
      interfaceForActorAndTargetIp(topology, context, event.actorNodeId, stringDetail(event.details, 'targetIp'))
    const targetInterfaceId = interfaceByIp(context, stringDetail(event.details, 'targetIp'))
      ?.networkInterface.id

    if (targetInterfaceId) {
      addPathMovement(sourceInterfaceId, targetInterfaceId)
    } else {
      addOutboundMovement(sourceInterfaceId)
    }

    return animations
  }

  if (event.type === 'arp-reply-sent') {
    const sourceInterfaceId = stringDetail(event.details, 'sourceInterfaceId')
    const requesterInterfaceId = stringDetail(event.details, 'requesterInterfaceId')

    if (requesterInterfaceId) {
      addPathMovement(sourceInterfaceId, requesterInterfaceId)
    } else {
      addOutboundMovement(sourceInterfaceId)
    }

    return animations
  }

  return animations
}

function buildAnimationContext(topology: TopologyState): AnimationContext {
  const interfacesById = new Map<InterfaceId, LocatedInterface>()
  const linksByInterfaceId = new Map<InterfaceId, NetworkLink[]>()

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      interfacesById.set(networkInterface.id, { node, networkInterface })
    }
  }

  for (const link of topology.links) {
    linksByInterfaceId.set(link.endpointA.interfaceId, [
      ...(linksByInterfaceId.get(link.endpointA.interfaceId) ?? []),
      link,
    ])
    linksByInterfaceId.set(link.endpointB.interfaceId, [
      ...(linksByInterfaceId.get(link.endpointB.interfaceId) ?? []),
      link,
    ])
  }

  return { interfacesById, linksByInterfaceId }
}

function interfacePath(
  context: AnimationContext,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
): InterfaceId[] {
  const visited = new Set<InterfaceId>([sourceInterfaceId])
  const queue: InterfaceId[][] = [[sourceInterfaceId]]

  while (queue.length > 0) {
    const path = queue.shift()

    if (!path) {
      break
    }

    const currentInterfaceId = path[path.length - 1]

    if (currentInterfaceId === targetInterfaceId) {
      return path
    }

    for (const nextInterfaceId of adjacentInterfaceIds(context, currentInterfaceId)) {
      if (visited.has(nextInterfaceId)) {
        continue
      }

      visited.add(nextInterfaceId)
      queue.push([...path, nextInterfaceId])
    }
  }

  return [sourceInterfaceId, targetInterfaceId]
}

function adjacentInterfaceIds(
  context: AnimationContext,
  interfaceId: InterfaceId,
): InterfaceId[] {
  const adjacent = new Set<InterfaceId>()
  const locatedInterface = context.interfacesById.get(interfaceId)

  for (const link of context.linksByInterfaceId.get(interfaceId) ?? []) {
    const peerInterfaceId = peerInterfaceIdForLink(link, interfaceId)

    if (peerInterfaceId) {
      adjacent.add(peerInterfaceId)
    }
  }

  if (locatedInterface?.node.type === 'switch') {
    for (const switchInterface of locatedInterface.node.interfaces) {
      if (switchInterface.id !== interfaceId) {
        adjacent.add(switchInterface.id)
      }
    }
  }

  return [...adjacent].filter((candidate) =>
    sameSegment(context, interfaceId, candidate),
  )
}

function sameSegment(
  context: AnimationContext,
  aInterfaceId: InterfaceId,
  bInterfaceId: InterfaceId,
): boolean {
  const a = context.interfacesById.get(aInterfaceId)?.networkInterface
  const b = context.interfacesById.get(bInterfaceId)?.networkInterface

  return Boolean(a?.segmentId && a.segmentId === b?.segmentId)
}

function linkBetweenInterfaces(
  links: NetworkLink[],
  aInterfaceId: InterfaceId,
  bInterfaceId: InterfaceId,
): NetworkLink | undefined {
  return links.find(
    (link) =>
      (link.endpointA.interfaceId === aInterfaceId &&
        link.endpointB.interfaceId === bInterfaceId) ||
      (link.endpointA.interfaceId === bInterfaceId &&
        link.endpointB.interfaceId === aInterfaceId),
  )
}

function directionForLink(
  link: NetworkLink,
  fromInterfaceId: InterfaceId,
  toInterfaceId: InterfaceId,
): LinkAnimationDirection {
  return link.endpointA.interfaceId === fromInterfaceId &&
    link.endpointB.interfaceId === toInterfaceId
    ? 'source-to-target'
    : 'target-to-source'
}

function peerInterfaceIdForLink(
  link: NetworkLink,
  interfaceId: InterfaceId,
): InterfaceId | undefined {
  if (link.endpointA.interfaceId === interfaceId) {
    return link.endpointB.interfaceId
  }

  if (link.endpointB.interfaceId === interfaceId) {
    return link.endpointA.interfaceId
  }

  return undefined
}

function interfaceByIp(
  context: AnimationContext,
  ipAddress: string | undefined,
): LocatedInterface | undefined {
  if (!ipAddress) {
    return undefined
  }

  return [...context.interfacesById.values()].find(
    (locatedInterface) =>
      locatedInterface.networkInterface.ipAddress === ipAddress,
  )
}

function interfaceForActorAndTargetIp(
  topology: TopologyState,
  context: AnimationContext,
  actorNodeId: string | undefined,
  targetIp: string | undefined,
): InterfaceId | undefined {
  const actorNode = topology.nodes.find((node) => node.id === actorNodeId)
  const targetInterface = interfaceByIp(context, targetIp)?.networkInterface

  if (!actorNode) {
    return undefined
  }

  if (targetInterface?.segmentId) {
    return actorNode.interfaces.find(
      (networkInterface) =>
        networkInterface.segmentId === targetInterface.segmentId,
    )?.id
  }

  return actorNode.interfaces[0]?.id
}

function stringDetail(
  details: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key]

  return typeof value === 'string' ? value : undefined
}

function stringArrayDetail(
  details: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = details?.[key]

  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : []
}
