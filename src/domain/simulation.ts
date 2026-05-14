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
import { validateTopology } from './validation'
import type {
  EthernetFrame,
  HostNode,
  IPv4Datagram,
  NetworkInterface,
  NetworkNode,
  PacketDropReason,
  PacketTrace,
  PacketType,
  RouterNode,
  SimulationEvent,
  TopologyState,
} from './types'

export interface Ipv4SimulationInput {
  sourceHostId: string
  destinationIp: string
  ttl: number
  packetType?: PacketType
  payload?: string
}

interface LocatedInterface {
  node: NetworkNode
  networkInterface: NetworkInterface
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
  })
}

function simulateIpv4PacketInternal(
  topology: TopologyState,
  input: Ipv4SimulationInput,
  options: {
    packetId: string
    allowIcmpReply: boolean
    icmpReply: boolean
  },
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

  const nextHopInterface = interfaceByIp(topology, arpTarget.targetIp)

  if (!nextHopInterface) {
    eventBuilder.addDrop(packetId, sourceHost.id, 'No ARP Reply')
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: 'No ARP Reply',
    })
  }

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
  options: {
    packetId: string
    allowIcmpReply: boolean
    icmpReply: boolean
  },
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

  return result
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
  options: {
    packetId: string
    allowIcmpReply: boolean
    icmpReply: boolean
  },
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
      packetId: 'packet-2',
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
