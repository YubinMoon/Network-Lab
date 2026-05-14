import { selectHostArpTarget } from './arp'
import {
  createIcmpEchoReply,
  createIcmpEchoRequest,
  isIcmpEchoRequest,
} from './icmp'
import {
  createIpv4Datagram,
  createIpv4Frame,
  forwardIpv4FrameAtRouter,
} from './ipv4'
import { BROADCAST_MAC } from './types'
import { validateTopology } from './validation'
import type {
  EthernetFrame,
  HostNode,
  InterfaceId,
  IPv4Datagram,
  LinkId,
  NetworkInterface,
  NetworkNode,
  PacketDropReason,
  PacketTrace,
  PacketType,
  RouterNode,
  SegmentId,
  SimulationEvent,
  TopologyState,
} from './types'

export interface Ipv4SimulationInput {
  sourceHostId: string
  destinationIp: string
  ttl: number
  packetType?: PacketType
  payload?: string
  packetCount?: number
  intervalMs?: number
}

interface LocatedInterface {
  node: NetworkNode
  networkInterface: NetworkInterface
}

interface SimulationRunOptions {
  packetId: string
  allowIcmpReply: boolean
  icmpReply: boolean
  replyPacketId?: string
}

export function simulateIpv4Packet(
  topology: TopologyState,
  input: Ipv4SimulationInput,
): PacketTrace {
  const unsupportedLoop = validateTopology(topology).find(
    (issue) => issue.code === 'unsupported-l2-loop',
  )

  if (topology.settings.blockUnsupportedL2Loops && unsupportedLoop) {
    return droppedTrace(
      'packet-1',
      input,
      'Unsupported L2 Loop',
      createEventBuilder(),
    )
  }

  return simulateIpv4PacketInternal(topology, input, {
    packetId: 'packet-1',
    allowIcmpReply: true,
    icmpReply: false,
    replyPacketId: 'packet-2',
  })
}

export function simulateIpv4PacketBatch(
  topology: TopologyState,
  input: Ipv4SimulationInput,
): PacketTrace {
  const packetCount = normalizePacketCount(input.packetCount)

  if (packetCount === 1) {
    return simulateIpv4Packet(topology, input)
  }

  const unsupportedLoop = validateTopology(topology).find(
    (issue) => issue.code === 'unsupported-l2-loop',
  )

  if (topology.settings.blockUnsupportedL2Loops && unsupportedLoop) {
    return droppedTrace(
      'packet-1',
      input,
      'Unsupported L2 Loop',
      createEventBuilder(),
    )
  }

  const packetTraces = Array.from({ length: packetCount }, (_, index) => {
    const packetId = `packet-${index + 1}`

    return simulateIpv4PacketInternal(topology, input, {
      packetId,
      allowIcmpReply: true,
      icmpReply: false,
      replyPacketId: `${packetId}-reply`,
    })
  })

  return mergePacketTraces(input, packetTraces)
}

function simulateIpv4PacketInternal(
  topology: TopologyState,
  input: Ipv4SimulationInput,
  options: SimulationRunOptions,
): PacketTrace {
  const eventBuilder = createEventBuilder()
  const packetId = options.packetId
  const sourceHost = topology.nodes.find(
    (node): node is HostNode =>
      node.type === 'host' && node.id === input.sourceHostId,
  )
  const sourceInterface = sourceHost?.interfaces[0]

  if (!sourceHost || !sourceInterface?.ipAddress || !sourceInterface.prefixLength) {
    return droppedTrace(
      packetId,
      input,
      'Invalid IP Configuration',
      eventBuilder,
    )
  }

  const datagram = createIpv4Datagram({
    id: packetId,
    srcIp: sourceInterface.ipAddress,
    dstIp: input.destinationIp,
    ttl: input.ttl,
    protocol: input.packetType === 'icmp-echo' ? 'ICMP' : 'RAW',
    payload:
      input.packetType === 'icmp-echo'
        ? options.icmpReply
          ? createIcmpEchoReply(createIcmpEchoRequest({ data: input.payload }))
          : createIcmpEchoRequest({ data: input.payload })
        : { data: input.payload ?? '' },
  })
  eventBuilder.add('host-subnet-check', sourceHost.id, {
    description: `${sourceHost.name} checked destination network.`,
    packetId,
    details: {
      sourceIp: sourceInterface.ipAddress,
      destinationIp: input.destinationIp,
      prefixLength: sourceInterface.prefixLength,
    },
  })

  const arpTarget = selectHostArpTarget(
    sourceInterface.ipAddress,
    sourceInterface.prefixLength,
    input.destinationIp,
    sourceHost.defaultGatewayIp,
  )

  if (arpTarget.status === 'drop') {
    eventBuilder.addDrop(packetId, sourceHost.id, arpTarget.reason)
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: arpTarget.reason,
    })
  }

  if (arpTarget.reason === 'default-gateway') {
    eventBuilder.add('host-default-gateway-selected', sourceHost.id, {
      description: `${sourceHost.name} selected Default Gateway ${arpTarget.targetIp}.`,
      packetId,
      details: { nextHopIp: arpTarget.targetIp },
    })
  }

  eventBuilder.add('arp-cache-miss', sourceHost.id, {
    description: `${sourceHost.name} ARP Cache miss for ${arpTarget.targetIp}.`,
    packetId,
    details: { targetIp: arpTarget.targetIp },
  })
  eventBuilder.add('arp-request-sent', sourceHost.id, {
    description: `${sourceHost.name} sent ARP Request for ${arpTarget.targetIp}.`,
    packetId,
    details: { targetIp: arpTarget.targetIp },
  })
  addSwitchForwardingEvents({
    topology,
    segmentId: sourceInterface.segmentId,
    sourceInterface,
    sourceMac: sourceInterface.macAddress,
    destinationMac: BROADCAST_MAC,
    packetId,
    eventBuilder,
  })

  const nextHopInterface = interfaceByIp(topology, arpTarget.targetIp)

  if (!nextHopInterface) {
    eventBuilder.addDrop(packetId, sourceHost.id, 'No ARP Reply')
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: 'No ARP Reply',
    })
  }

  const l2DropReason = packetDropBetweenInterfaces(
    topology,
    sourceInterface,
    nextHopInterface.networkInterface,
  )

  if (l2DropReason) {
    eventBuilder.addDrop(packetId, sourceHost.id, l2DropReason)
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: l2DropReason,
    })
  }

  addArpReplyAndCacheEvents({
    topology,
    requester: sourceHost,
    requesterInterface: sourceInterface,
    responder: nextHopInterface,
    targetIp: arpTarget.targetIp,
    packetId,
    eventBuilder,
  })
  addSwitchForwardingEvents({
    topology,
    segmentId: sourceInterface.segmentId,
    sourceInterface,
    sourceMac: sourceInterface.macAddress,
    destinationMac: nextHopInterface.networkInterface.macAddress,
    packetId,
    eventBuilder,
  })

  if (nextHopInterface.node.type === 'host') {
    eventBuilder.add('packet-delivered', nextHopInterface.node.id, {
      description: `${nextHopInterface.node.name} delivered IPv4 Datagram.`,
      packetId,
      details: { datagram },
    })
    return maybeReplyToIcmpEcho(
      topology,
      input,
      packetId,
      datagram,
      nextHopInterface.node,
      eventBuilder.events,
      options,
    )
  }

  if (nextHopInterface.node.type !== 'router') {
    eventBuilder.addDrop(packetId, sourceHost.id, 'Network Unreachable')
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: 'Network Unreachable',
    })
  }

  return forwardThroughRouters(
    topology,
    input,
    packetId,
    datagram,
    sourceInterface,
    nextHopInterface.node,
    nextHopInterface.networkInterface,
    eventBuilder,
    options,
  )
}

function forwardThroughRouters(
  topology: TopologyState,
  input: Ipv4SimulationInput,
  packetId: string,
  initialDatagram: IPv4Datagram,
  sourceInterface: NetworkInterface,
  firstRouter: RouterNode,
  firstRouterInterface: NetworkInterface,
  eventBuilder: ReturnType<typeof createEventBuilder>,
  options: SimulationRunOptions,
): PacketTrace {
  let currentRouter = firstRouter
  let ingressInterface = firstRouterInterface
  let incomingFrame = createIpv4Frame({
    frameId: 'frame-1',
    srcMac: sourceInterface.macAddress,
    dstMac: ingressInterface.macAddress,
    datagram: initialDatagram,
  })
  const maxHops = topology.nodes.length + 4

  for (let hop = 0; hop < maxHops; hop += 1) {
    const routerResult = forwardAtRouterWithEvents(
      topology,
      currentRouter,
      ingressInterface,
      incomingFrame,
      `frame-${hop + 2}`,
      eventBuilder,
    )

    if (routerResult.status === 'dropped') {
      return trace(packetId, input, eventBuilder.events, {
        status: 'dropped',
        reason: routerResult.reason ?? 'Network Unreachable',
      })
    }

    if (!routerResult.frame) {
      eventBuilder.addDrop(packetId, currentRouter.id, 'Network Unreachable')
      return trace(packetId, input, eventBuilder.events, {
        status: 'dropped',
        reason: 'Network Unreachable',
      })
    }

    const destinationInterface = interfaceByIp(topology, input.destinationIp)

    if (
      destinationInterface &&
      routerResult.outInterface?.segmentId ===
        destinationInterface.networkInterface.segmentId
    ) {
      eventBuilder.add('packet-delivered', destinationInterface.node.id, {
        description: `${destinationInterface.node.name} delivered IPv4 Datagram.`,
        packetId,
        details: {
          datagram: routerResult.datagram,
          ethernetFrame: routerResult.frame,
        },
      })
      return maybeReplyToIcmpEcho(
        topology,
        input,
        packetId,
        routerResult.datagram ?? initialDatagram,
        destinationInterface.node,
        eventBuilder.events,
        options,
      )
    }

    const nextHopInterface = routerResult.nextHopIp
      ? interfaceByIp(topology, routerResult.nextHopIp)
      : undefined

    if (!nextHopInterface || nextHopInterface.node.type !== 'router') {
      eventBuilder.addDrop(packetId, currentRouter.id, 'Network Unreachable')
      return trace(packetId, input, eventBuilder.events, {
        status: 'dropped',
        reason: 'Network Unreachable',
      })
    }

    currentRouter = nextHopInterface.node
    ingressInterface = nextHopInterface.networkInterface
    incomingFrame = routerResult.frame
  }

  eventBuilder.addDrop(packetId, currentRouter.id, 'TTL Expired')
  return trace(packetId, input, eventBuilder.events, {
    status: 'dropped',
    reason: 'TTL Expired',
  })
}

function forwardAtRouterWithEvents(
  topology: TopologyState,
  router: RouterNode,
  ingressInterface: NetworkInterface,
  frame: EthernetFrame,
  nextFrameId: string,
  eventBuilder: ReturnType<typeof createEventBuilder>,
) {
  const datagram = frame.payload as IPv4Datagram

  eventBuilder.add('router-frame-received', router.id, {
    description: `${router.name} received Ethernet Frame on ${ingressInterface.name}.`,
    packetId: datagram.id,
    frameId: frame.id,
    details: { ethernetFrame: frame },
  })
  eventBuilder.add('router-frame-decapsulated', router.id, {
    description: `${router.name} decapsulated IPv4 Datagram.`,
    packetId: datagram.id,
    frameId: frame.id,
    details: { datagram },
  })

  const routeCandidate = router.routingTable.find((route) =>
    route.enabled ? route.destinationNetwork : false,
  )
  const result = forwardIpv4FrameAtRouter({
    router,
    ingressInterfaceId: ingressInterface.id,
    frame,
    resolveMacForIp: (ipAddress) =>
      interfaceByIp(topology, ipAddress)?.networkInterface.macAddress,
    frameId: nextFrameId,
  })

  if (result.previousTtl !== undefined && result.datagram) {
    eventBuilder.add('router-ttl-decremented', router.id, {
      description: `${router.name} decremented TTL from ${result.previousTtl} to ${result.datagram.ttl}.`,
      packetId: datagram.id,
      details: {
        previousTtl: result.previousTtl,
        nextTtl: result.datagram.ttl,
      },
    })
  }

  eventBuilder.add('router-route-lookup-started', router.id, {
    description: `${router.name} started Routing Table Lookup for ${datagram.dstIp}.`,
    packetId: datagram.id,
    details: { destinationIp: datagram.dstIp, routeCandidate },
  })

  if (result.status === 'dropped') {
    eventBuilder.addDrop(datagram.id, router.id, result.reason ?? 'Network Unreachable')
    return result
  }

  eventBuilder.add('router-route-selected', router.id, {
    description: `${router.name} selected ${result.selectedRoute?.destinationNetwork}/${result.selectedRoute?.prefixLength} by Longest Prefix Match.`,
    packetId: datagram.id,
    details: { selectedRoute: result.selectedRoute },
  })
  eventBuilder.add('router-next-hop-selected', router.id, {
    description: `${router.name} selected Next Hop ${result.nextHopIp} through ${result.outInterface?.name}.`,
    packetId: datagram.id,
    details: {
      nextHopIp: result.nextHopIp,
      outInterfaceId: result.outInterface?.id,
    },
  })
  if (result.nextHopIp && result.outInterface) {
    eventBuilder.add('arp-cache-miss', router.id, {
      description: `${router.name} ARP Cache miss for ${result.nextHopIp}.`,
      packetId: datagram.id,
      details: { targetIp: result.nextHopIp },
    })
    eventBuilder.add('arp-request-sent', router.id, {
      description: `${router.name} sent ARP Request for ${result.nextHopIp}.`,
      packetId: datagram.id,
      details: { targetIp: result.nextHopIp },
    })
    addSwitchForwardingEvents({
      topology,
      segmentId: result.outInterface.segmentId,
      sourceInterface: result.outInterface,
      sourceMac: result.outInterface.macAddress,
      destinationMac: BROADCAST_MAC,
      packetId: datagram.id,
      eventBuilder,
    })

    const arpResponder = interfaceByIp(topology, result.nextHopIp)

    if (!arpResponder) {
      eventBuilder.addDrop(datagram.id, router.id, 'No ARP Reply')
      return {
        ...result,
        status: 'dropped' as const,
        frame: undefined,
        reason: 'No ARP Reply' as const,
      }
    }

    const l2DropReason = packetDropBetweenInterfaces(
      topology,
      result.outInterface,
      arpResponder.networkInterface,
    )

    if (l2DropReason) {
      eventBuilder.addDrop(datagram.id, router.id, l2DropReason)
      return {
        ...result,
        status: 'dropped' as const,
        frame: undefined,
        reason: l2DropReason,
      }
    }

    addArpReplyAndCacheEvents({
      topology,
      requester: router,
      requesterInterface: result.outInterface,
      responder: arpResponder,
      targetIp: result.nextHopIp,
      packetId: datagram.id,
      eventBuilder,
    })
  }
  eventBuilder.add('router-frame-encapsulated', router.id, {
    description: `${router.name} created new Ethernet Frame.`,
    packetId: datagram.id,
    frameId: result.frame?.id,
    details: { ethernetFrame: result.frame },
  })
  eventBuilder.add('packet-forwarded', router.id, {
    description: `${router.name} forwarded frame out ${result.outInterface?.name}.`,
    packetId: datagram.id,
    frameId: result.frame?.id,
    details: { outInterfaceId: result.outInterface?.id },
  })
  if (result.outInterface && result.frame) {
    addSwitchForwardingEvents({
      topology,
      segmentId: result.outInterface.segmentId,
      sourceInterface: result.outInterface,
      sourceMac: result.frame.srcMac,
      destinationMac: result.frame.dstMac,
      packetId: datagram.id,
      eventBuilder,
    })
  }

  return result
}

function addArpReplyAndCacheEvents({
  topology,
  requester,
  requesterInterface,
  responder,
  targetIp,
  packetId,
  eventBuilder,
}: {
  topology: TopologyState
  requester: NetworkNode
  requesterInterface: NetworkInterface
  responder: LocatedInterface
  targetIp: string
  packetId: string
  eventBuilder: ReturnType<typeof createEventBuilder>
}) {
  eventBuilder.add('arp-reply-sent', responder.node.id, {
    description: `${responder.node.name} sent ARP Reply for ${targetIp}.`,
    packetId,
    details: {
      ipAddress: targetIp,
      macAddress: responder.networkInterface.macAddress,
    },
  })
  addSwitchForwardingEvents({
    topology,
    segmentId: requesterInterface.segmentId,
    sourceInterface: responder.networkInterface,
    sourceMac: responder.networkInterface.macAddress,
    destinationMac: requesterInterface.macAddress,
    packetId,
    eventBuilder,
  })
  eventBuilder.add('arp-cache-updated', requester.id, {
    description: `${requester.name} updated ARP Cache for ${targetIp}.`,
    packetId,
    details: {
      ipAddress: targetIp,
      macAddress: responder.networkInterface.macAddress,
      interfaceId: requesterInterface.id,
    },
  })
}

function addSwitchForwardingEvents({
  topology,
  segmentId,
  sourceInterface,
  sourceMac,
  destinationMac,
  packetId,
  eventBuilder,
}: {
  topology: TopologyState
  segmentId?: SegmentId
  sourceInterface: NetworkInterface
  sourceMac: string
  destinationMac: string
  packetId: string
  eventBuilder: ReturnType<typeof createEventBuilder>
}) {
  if (!segmentId) {
    return
  }

  for (const switchNode of topology.nodes.filter(
    (node) => node.type === 'switch',
  )) {
    const segmentInterfaces = switchNode.interfaces.filter(
      (networkInterface) => networkInterface.segmentId === segmentId,
    )

    if (segmentInterfaces.length === 0) {
      continue
    }

    const ingressInterface =
      segmentInterfaces.find((networkInterface) =>
        isReachableInsideSegment(
          topology,
          sourceInterface.id,
          networkInterface.id,
          segmentId,
        ),
      ) ?? segmentInterfaces[0]
    const egressInterfaceIds = segmentInterfaces
      .map((networkInterface) => networkInterface.id)
      .filter((interfaceId) => interfaceId !== ingressInterface.id)
    const learnedEntry = {
      macAddress: sourceMac,
      portInterfaceId: ingressInterface.id,
      ageSeconds: 0,
    }

    eventBuilder.add('switch-frame-received', switchNode.id, {
      description: `${switchNode.name} received Ethernet Frame on ${ingressInterface.name}.`,
      packetId,
      details: { ingressInterfaceId: ingressInterface.id },
    })
    eventBuilder.add('switch-source-mac-learned', switchNode.id, {
      description: `${switchNode.name} learned source MAC ${sourceMac}.`,
      packetId,
      details: {
        macAddress: sourceMac,
        portInterfaceId: ingressInterface.id,
        macAddressTable: [learnedEntry],
      },
    })

    if (destinationMac === BROADCAST_MAC) {
      eventBuilder.add('switch-broadcast-flooded', switchNode.id, {
        description: `${switchNode.name} flooded broadcast Ethernet Frame.`,
        packetId,
        details: { egressInterfaceIds },
      })
    } else {
      eventBuilder.add('switch-known-unicast-forwarded', switchNode.id, {
        description: `${switchNode.name} forwarded known unicast Ethernet Frame.`,
        packetId,
        details: {
          destinationMac,
          egressInterfaceIds,
        },
      })
    }
  }
}

function packetDropBetweenInterfaces(
  topology: TopologyState,
  sourceInterface: NetworkInterface,
  targetInterface: NetworkInterface,
): PacketDropReason | undefined {
  if (sourceInterface.status === 'down' || targetInterface.status === 'down') {
    return 'Interface Down'
  }

  if (
    !sourceInterface.segmentId ||
    sourceInterface.segmentId !== targetInterface.segmentId
  ) {
    return 'Network Unreachable'
  }

  const pathLinkIds = findSegmentPathLinkIds(
    topology,
    sourceInterface.id,
    targetInterface.id,
    sourceInterface.segmentId,
  )

  if (!pathLinkIds) {
    return 'Network Unreachable'
  }

  for (const linkId of pathLinkIds) {
    const networkLink = topology.links.find((link) => link.id === linkId)

    if (!networkLink || networkLink.status === 'down') {
      return 'Link Down'
    }

    if (networkLink.lossRate >= 1) {
      return 'Link Loss'
    }
  }

  return undefined
}

function isReachableInsideSegment(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): boolean {
  return Boolean(
    findSegmentPathLinkIds(
      topology,
      sourceInterfaceId,
      targetInterfaceId,
      segmentId,
    ),
  )
}

function findSegmentPathLinkIds(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): LinkId[] | undefined {
  const interfacesById = new Map<InterfaceId, NetworkInterface>()

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      interfacesById.set(networkInterface.id, networkInterface)
    }
  }

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

  const adjacency = new Map<
    InterfaceId,
    Array<{ interfaceId: InterfaceId; linkId?: LinkId }>
  >()
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

  for (const switchNode of topology.nodes.filter(
    (node) => node.type === 'switch',
  )) {
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

  const visited = new Set<InterfaceId>([sourceInterfaceId])
  const queue: Array<{ interfaceId: InterfaceId; pathLinkIds: LinkId[] }> = [
    { interfaceId: sourceInterfaceId, pathLinkIds: [] },
  ]

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      break
    }

    if (current.interfaceId === targetInterfaceId) {
      return current.pathLinkIds
    }

    for (const adjacent of adjacency.get(current.interfaceId) ?? []) {
      if (visited.has(adjacent.interfaceId)) {
        continue
      }

      visited.add(adjacent.interfaceId)
      queue.push({
        interfaceId: adjacent.interfaceId,
        pathLinkIds: adjacent.linkId
          ? [...current.pathLinkIds, adjacent.linkId]
          : current.pathLinkIds,
      })
    }
  }

  return undefined
}

function interfaceByIp(
  topology: TopologyState,
  ipAddress: string,
): LocatedInterface | undefined {
  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      if (networkInterface.ipAddress === ipAddress) {
        return { node, networkInterface }
      }
    }
  }

  return undefined
}

function droppedTrace(
  packetId: string,
  input: Ipv4SimulationInput,
  reason: PacketDropReason,
  eventBuilder: ReturnType<typeof createEventBuilder>,
): PacketTrace {
  eventBuilder.addDrop(packetId, input.sourceHostId, reason)
  return trace(packetId, input, eventBuilder.events, {
    status: 'dropped',
    reason,
  })
}

function trace(
  packetId: string,
  input: Ipv4SimulationInput,
  events: SimulationEvent[],
  result: PacketTrace['result'],
): PacketTrace {
  return {
    packetId,
    packetType: input.packetType ?? 'generic-ipv4',
    sourceHostId: input.sourceHostId,
    destinationIp: input.destinationIp,
    result,
    events,
  }
}

function maybeReplyToIcmpEcho(
  topology: TopologyState,
  input: Ipv4SimulationInput,
  packetId: string,
  datagram: IPv4Datagram,
  destinationNode: NetworkNode,
  requestEvents: SimulationEvent[],
  options: SimulationRunOptions,
): PacketTrace {
  if (
    input.packetType !== 'icmp-echo' ||
    options.icmpReply ||
    !options.allowIcmpReply ||
    destinationNode.type !== 'host' ||
    !isIcmpEchoRequest(datagram)
  ) {
    return trace(packetId, input, requestEvents, { status: 'delivered' })
  }

  const replyTrace = simulateIpv4PacketInternal(
    topology,
    {
      sourceHostId: destinationNode.id,
      destinationIp: datagram.srcIp,
      ttl: topology.settings.defaultTtl,
      packetType: 'icmp-echo',
      payload:
        'data' in datagram.payload && typeof datagram.payload.data === 'string'
          ? datagram.payload.data
          : '',
    },
    {
      packetId: options.replyPacketId ?? `${packetId}-reply`,
      allowIcmpReply: false,
      icmpReply: true,
    },
  )
  const events = [
    ...requestEvents,
    ...replyTrace.events.map((event, index) => ({
      ...event,
      id: `event-${requestEvents.length + index + 1}`,
      timeMs: requestEvents.length + index,
    })),
  ]

  return trace(packetId, input, events, replyTrace.result)
}

function normalizePacketCount(packetCount: number | undefined): number {
  if (!packetCount || !Number.isFinite(packetCount)) {
    return 1
  }

  return Math.max(1, Math.floor(packetCount))
}

function mergePacketTraces(
  input: Ipv4SimulationInput,
  packetTraces: PacketTrace[],
): PacketTrace {
  const events: SimulationEvent[] = []

  for (const packetTrace of packetTraces) {
    for (const event of packetTrace.events) {
      events.push({
        ...event,
        id: `event-${events.length + 1}`,
        timeMs: events.length,
      })
    }
  }

  const droppedResult = packetTraces.find(
    (packetTrace) => packetTrace.result.status === 'dropped',
  )?.result

  return {
    packetId: packetTraces[0]?.packetId ?? 'packet-1',
    packetType: input.packetType ?? 'generic-ipv4',
    sourceHostId: input.sourceHostId,
    destinationIp: input.destinationIp,
    result: droppedResult ?? { status: 'delivered' },
    events,
  }
}

function createEventBuilder() {
  const events: SimulationEvent[] = []

  return {
    events,
    add(
      type: SimulationEvent['type'],
      actorNodeId: string,
      options: {
        description: string
        packetId?: string
        frameId?: string
        details?: Record<string, unknown>
      },
    ) {
      events.push({
        id: `event-${events.length + 1}`,
        timeMs: events.length,
        type,
        actorNodeId,
        packetId: options.packetId,
        frameId: options.frameId,
        description: options.description,
        visualAction: { type: 'none' },
        details: options.details,
      })
    },
    addDrop(packetId: string, actorNodeId: string, reason: PacketDropReason) {
      events.push({
        id: `event-${events.length + 1}`,
        timeMs: events.length,
        type: 'packet-dropped',
        actorNodeId,
        packetId,
        description: `Packet Drop: ${reason}.`,
        visualAction: { type: 'drop-packet', packetId, reason },
        details: { reason },
      })
    },
  }
}
