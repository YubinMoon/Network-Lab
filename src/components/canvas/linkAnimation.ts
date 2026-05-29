import type {
  InterfaceId,
  LinkId,
  NetworkLink,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'
import { findInterfacePathInterfaceIds } from '../../domain/interfacePath'
import { interfaceByIp, type LocatedInterface } from '../../domain/networkLookup'
import {
  stringArrayDetail,
  stringDetail,
} from '../../domain/inspectionUtils'

export type LinkAnimationDirection = 'source-to-target' | 'target-to-source'

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

    const path = interfacePath(topology, context, fromInterfaceId, toInterfaceId)

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
      interfaceForActorAndTargetIp(
        topology,
        event.actorNodeId,
        stringDetail(event.details, 'targetIp'),
      )

    addOutboundMovement(sourceInterfaceId)
    return animations
  }

  if (event.type === 'arp-reply-sent') {
    const sourceInterfaceId = stringDetail(event.details, 'sourceInterfaceId')

    addOutboundMovement(sourceInterfaceId)
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
  topology: TopologyState,
  context: AnimationContext,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
): InterfaceId[] {
  const source = context.interfacesById.get(sourceInterfaceId)?.networkInterface
  const target = context.interfacesById.get(targetInterfaceId)?.networkInterface

  if (!source || !target || !source.segmentId || source.segmentId !== target.segmentId) {
    return [sourceInterfaceId, targetInterfaceId]
  }

  return (
    findInterfacePathInterfaceIds(
      topology,
      sourceInterfaceId,
      targetInterfaceId,
      source.segmentId,
    ) ?? [sourceInterfaceId, targetInterfaceId]
  )
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

function interfaceForActorAndTargetIp(
  topology: TopologyState,
  actorNodeId: string | undefined,
  targetIp: string | undefined,
): InterfaceId | undefined {
  const actorNode = topology.nodes.find((node) => node.id === actorNodeId)
  const targetInterface = targetIp ? interfaceByIp(topology, targetIp)?.networkInterface : undefined

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
