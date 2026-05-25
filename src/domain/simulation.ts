import {
  createArpReplyFrame,
  createArpRequestFrame,
  findArpCacheEntry,
  selectHostArpTarget,
} from './arp'
import {
  createIcmpEchoReply,
  createIcmpEchoRequest,
  isIcmpEchoRequest,
} from './icmp'
import { applySimulationTraceToTopology } from './dynamicTables'
import {
  createIpv4Datagram,
  createIpv4Frame,
  forwardIpv4FrameAtRouter,
} from './ipv4'
import {
  fragmentIpv4Datagram,
  ipv4TotalLength,
  normalizeMtu,
} from './fragmentation'
import { ipMatchesPrefix } from './ip'
import { processSwitchFrame } from './l2'
import { normalizeMac } from './mac'
import { BROADCAST_MAC, DEFAULT_LINK_MTU } from './types'
import { validateTopology } from './validation'
import type {
  EthernetFrame,
  HostNode,
  InterfaceId,
  IPv4Datagram,
  LinkId,
  MacTableEntry,
  NetworkInterface,
  NetworkNode,
  PacketDropReason,
  PacketTrace,
  PacketType,
  RouterNode,
  SegmentId,
  SimulationEvent,
  SwitchNode,
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

  const packetTraces: PacketTrace[] = []
  let currentTopology = topology

  for (let index = 0; index < packetCount; index += 1) {
    const packetId = `packet-${index + 1}`
    const packetTrace = simulateIpv4PacketInternal(currentTopology, input, {
      packetId,
      allowIcmpReply: true,
      icmpReply: false,
      replyPacketId: `${packetId}-reply`,
    })

    packetTraces.push(packetTrace)
    currentTopology = applySimulationTraceToTopology(currentTopology, packetTrace)
  }

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
  const sourceInterface = sourceHost
    ? selectSourceInterface(sourceHost, input.destinationIp)
    : undefined

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

  const cachedArpEntry = findArpCacheEntry(
    sourceHost.arpCache,
    arpTarget.targetIp,
  )

  if (cachedArpEntry) {
    eventBuilder.add('arp-cache-hit', sourceHost.id, {
      description: `${sourceHost.name} ARP Cache hit for ${arpTarget.targetIp}.`,
      packetId,
      details: {
        ipAddress: cachedArpEntry.ipAddress,
        macAddress: cachedArpEntry.macAddress,
        interfaceId: cachedArpEntry.interfaceId,
      },
    })
  } else {
    const arpRequestFrame = createArpRequestFrame({
      frameId: `${packetId}-arp-request`,
      senderIp: sourceInterface.ipAddress,
      senderMac: sourceInterface.macAddress,
      targetIp: arpTarget.targetIp,
    })

    eventBuilder.add('arp-cache-miss', sourceHost.id, {
      description: `${sourceHost.name} ARP Cache miss for ${arpTarget.targetIp}.`,
      packetId,
      details: { targetIp: arpTarget.targetIp },
    })
    eventBuilder.add('arp-request-sent', sourceHost.id, {
      description: `${sourceHost.name} sent ARP Request for ${arpTarget.targetIp}.`,
      packetId,
      frameId: arpRequestFrame.id,
      details: {
        ethernetFrame: arpRequestFrame,
        sourceInterfaceId: sourceInterface.id,
        targetIp: arpTarget.targetIp,
      },
    })
    addSwitchForwardingEvents({
      topology,
      segmentId: sourceInterface.segmentId,
      sourceInterface,
      ethernetFrame: arpRequestFrame,
      packetId,
      eventBuilder,
    })
  }

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

  if (!cachedArpEntry) {
    addArpReplyAndCacheEvents({
      topology,
      requester: sourceHost,
      requesterInterface: sourceInterface,
      responder: nextHopInterface,
      targetIp: arpTarget.targetIp,
      packetId,
      eventBuilder,
    })
  }
  const sourceFragmentation = fragmentDatagramForPath({
    topology,
    datagram,
    sourceInterface,
    targetInterface: nextHopInterface.networkInterface,
    actorNodeId: sourceHost.id,
    actorName: sourceHost.name,
    eventBuilder,
  })

  if (sourceFragmentation.status === 'dropped') {
    return trace(packetId, input, eventBuilder.events, {
      status: 'dropped',
      reason: sourceFragmentation.reason,
    })
  }

  const outboundFrames = createIpv4Frames({
    frameId: 'frame-1',
    srcMac: sourceInterface.macAddress,
    dstMac:
      cachedArpEntry?.macAddress ?? nextHopInterface.networkInterface.macAddress,
    datagrams: sourceFragmentation.datagrams,
  })

  for (const outboundFrame of outboundFrames) {
    addSwitchForwardingEvents({
      topology,
      segmentId: sourceInterface.segmentId,
      sourceInterface,
      ethernetFrame: outboundFrame,
      packetId,
      eventBuilder,
    })
  }

  if (nextHopInterface.node.type === 'host') {
    for (const outboundFrame of outboundFrames) {
      eventBuilder.add('packet-delivered', nextHopInterface.node.id, {
        description: `${nextHopInterface.node.name} delivered IPv4 Datagram.`,
        packetId,
        frameId: outboundFrame.id,
        details: {
          datagram: outboundFrame.payload,
          ethernetFrame: outboundFrame,
          sourceInterfaceId: sourceInterface.id,
          deliveredInterfaceId: nextHopInterface.networkInterface.id,
        },
      })
    }
    addReassemblyEventIfNeeded({
      datagram,
      datagrams: sourceFragmentation.datagrams,
      actorNodeId: nextHopInterface.node.id,
      actorName: nextHopInterface.node.name,
      eventBuilder,
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

  if (outboundFrames.length > 1) {
    for (const outboundFrame of outboundFrames) {
      const fragmentDatagram = outboundFrame.payload as IPv4Datagram
      const fragmentTrace = forwardThroughRouters(
        topology,
        input,
        packetId,
        fragmentDatagram,
        sourceInterface,
        nextHopInterface.node,
        nextHopInterface.networkInterface,
        eventBuilder,
        { ...options, allowIcmpReply: false },
      )

      if (fragmentTrace.result.status === 'dropped') {
        return fragmentTrace
      }
    }

    return trace(packetId, input, eventBuilder.events, { status: 'delivered' })
  }

  return forwardThroughRouters(
    topology,
    input,
    packetId,
    sourceFragmentation.datagrams[0] ?? datagram,
    sourceInterface,
    nextHopInterface.node,
    nextHopInterface.networkInterface,
    eventBuilder,
    options,
  )
}

function selectSourceInterface(
  sourceHost: HostNode,
  destinationIp: string,
): NetworkInterface | undefined {
  return (
    sourceHost.interfaces.find(
      (networkInterface) =>
        networkInterface.ipAddress &&
        networkInterface.prefixLength !== undefined &&
        ipMatchesPrefix(
          destinationIp,
          networkInterface.ipAddress,
          networkInterface.prefixLength,
        ),
    ) ?? sourceHost.interfaces[0]
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
  const maxHops = Math.max(1, initialDatagram.ttl)

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
      const deliveredFrames = routerResult.frames ?? [routerResult.frame]

      for (const deliveredFrame of deliveredFrames) {
        eventBuilder.add('packet-delivered', destinationInterface.node.id, {
          description: `${destinationInterface.node.name} delivered IPv4 Datagram.`,
          packetId,
          frameId: deliveredFrame.id,
          details: {
            datagram: deliveredFrame.payload,
            ethernetFrame: deliveredFrame,
            sourceInterfaceId: routerResult.outInterface?.id,
            deliveredInterfaceId: destinationInterface.networkInterface.id,
          },
        })
      }
      addReassemblyEventIfNeeded({
        datagram: routerResult.datagram ?? initialDatagram,
        datagrams: deliveredFrames.map(
          (deliveredFrame) => deliveredFrame.payload as IPv4Datagram,
        ),
        actorNodeId: destinationInterface.node.id,
        actorName: destinationInterface.node.name,
        eventBuilder,
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
    details: {
      ethernetFrame: frame,
      ingressInterfaceId: ingressInterface.id,
    },
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
  let egressTargetInterface: NetworkInterface | undefined

  if (result.nextHopIp && result.outInterface) {
    const cachedArpEntry = findArpCacheEntry(router.arpCache, result.nextHopIp)

    if (cachedArpEntry) {
      eventBuilder.add('arp-cache-hit', router.id, {
        description: `${router.name} ARP Cache hit for ${result.nextHopIp}.`,
        packetId: datagram.id,
        details: {
          ipAddress: cachedArpEntry.ipAddress,
          macAddress: cachedArpEntry.macAddress,
          interfaceId: cachedArpEntry.interfaceId,
        },
      })
    } else {
      const arpRequestFrame = createArpRequestFrame({
        frameId: `${datagram.id}-arp-request`,
        senderIp: result.outInterface.ipAddress ?? '0.0.0.0',
        senderMac: result.outInterface.macAddress,
        targetIp: result.nextHopIp,
      })

      eventBuilder.add('arp-cache-miss', router.id, {
        description: `${router.name} ARP Cache miss for ${result.nextHopIp}.`,
        packetId: datagram.id,
        details: { targetIp: result.nextHopIp },
      })
      eventBuilder.add('arp-request-sent', router.id, {
        description: `${router.name} sent ARP Request for ${result.nextHopIp}.`,
        packetId: datagram.id,
        frameId: arpRequestFrame.id,
        details: {
          ethernetFrame: arpRequestFrame,
          sourceInterfaceId: result.outInterface.id,
          targetIp: result.nextHopIp,
        },
      })
      addSwitchForwardingEvents({
        topology,
        segmentId: result.outInterface.segmentId,
        sourceInterface: result.outInterface,
        ethernetFrame: arpRequestFrame,
        packetId: datagram.id,
        eventBuilder,
      })
    }

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
    egressTargetInterface = arpResponder.networkInterface

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

    if (!cachedArpEntry) {
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
  }
  const fragmentation =
    result.datagram && result.outInterface && egressTargetInterface
      ? fragmentDatagramForPath({
          topology,
          datagram: result.datagram,
          sourceInterface: result.outInterface,
          targetInterface: egressTargetInterface,
          actorNodeId: router.id,
          actorName: router.name,
          eventBuilder,
        })
      : { status: 'ok' as const, datagrams: result.datagram ? [result.datagram] : [] }

  if (fragmentation.status === 'dropped') {
    return {
      ...result,
      status: 'dropped' as const,
      frame: undefined,
      frames: undefined,
      reason: fragmentation.reason,
    }
  }

  const forwardedFrames =
    result.frame && result.outInterface
      ? createIpv4Frames({
          frameId: result.frame.id,
          srcMac: result.frame.srcMac,
          dstMac: result.frame.dstMac,
          datagrams: fragmentation.datagrams,
        })
      : result.frame
        ? [result.frame]
        : []
  const forwardedResult = {
    ...result,
    frame: forwardedFrames[0],
    frames: forwardedFrames,
  }

  eventBuilder.add('router-frame-encapsulated', router.id, {
    description: `${router.name} created new Ethernet Frame.`,
    packetId: datagram.id,
    frameId: forwardedResult.frame?.id,
    details: { ethernetFrame: forwardedResult.frame },
  })
  for (const forwardedFrame of forwardedFrames) {
    eventBuilder.add('packet-forwarded', router.id, {
      description: `${router.name} forwarded frame out ${result.outInterface?.name}.`,
      packetId: datagram.id,
      frameId: forwardedFrame.id,
      details: {
        ethernetFrame: forwardedFrame,
        outInterfaceId: result.outInterface?.id,
      },
    })
  }
  if (result.outInterface) {
    for (const forwardedFrame of forwardedFrames) {
      addSwitchForwardingEvents({
        topology,
        segmentId: result.outInterface.segmentId,
        sourceInterface: result.outInterface,
        ethernetFrame: forwardedFrame,
        packetId: datagram.id,
        eventBuilder,
      })
    }
  }

  return forwardedResult
}

function fragmentDatagramForPath({
  topology,
  datagram,
  sourceInterface,
  targetInterface,
  actorNodeId,
  actorName,
  eventBuilder,
}: {
  topology: TopologyState
  datagram: IPv4Datagram
  sourceInterface: NetworkInterface
  targetInterface: NetworkInterface
  actorNodeId: string
  actorName: string
  eventBuilder: ReturnType<typeof createEventBuilder>
}):
  | { status: 'ok'; datagrams: IPv4Datagram[] }
  | { status: 'dropped'; reason: PacketDropReason } {
  const mtu = pathMtuBetweenInterfaces(topology, sourceInterface, targetInterface)
  const fragmentation = fragmentIpv4Datagram(datagram, mtu)

  if (fragmentation.status === 'dropped') {
    eventBuilder.addDrop(
      datagram.originalDatagramId ?? datagram.id,
      actorNodeId,
      fragmentation.reason ?? 'Network Unreachable',
    )

    return {
      status: 'dropped',
      reason: fragmentation.reason ?? 'Network Unreachable',
    }
  }

  if (fragmentation.status === 'fragmented') {
    eventBuilder.add('ipv4-datagram-fragmented', actorNodeId, {
      description: `${actorName} fragmented IPv4 Datagram into ${fragmentation.datagrams.length} fragments for MTU ${fragmentation.mtu}.`,
      packetId: datagram.originalDatagramId ?? datagram.id,
      details: {
        datagram,
        fragments: fragmentation.datagrams,
        fragmentIds: fragmentation.datagrams.map((fragment) => fragment.id),
        mtu: fragmentation.mtu,
        originalTotalLength: ipv4TotalLength(datagram),
        maxFragmentPayloadLength: fragmentation.maxFragmentPayloadLength,
        sourceInterfaceId: sourceInterface.id,
        targetInterfaceId: targetInterface.id,
      },
    })
  }

  return { status: 'ok', datagrams: fragmentation.datagrams }
}

function createIpv4Frames({
  frameId,
  srcMac,
  dstMac,
  datagrams,
}: {
  frameId: string
  srcMac: string
  dstMac: string
  datagrams: IPv4Datagram[]
}): EthernetFrame[] {
  return datagrams.map((datagram, index) =>
    createIpv4Frame({
      frameId: datagrams.length === 1 ? frameId : `${frameId}-frag-${index + 1}`,
      srcMac,
      dstMac,
      datagram,
    }),
  )
}

function addReassemblyEventIfNeeded({
  datagram,
  datagrams,
  actorNodeId,
  actorName,
  eventBuilder,
}: {
  datagram: IPv4Datagram
  datagrams: IPv4Datagram[]
  actorNodeId: string
  actorName: string
  eventBuilder: ReturnType<typeof createEventBuilder>
}) {
  if (datagrams.length <= 1) {
    return
  }

  eventBuilder.add('ipv4-fragments-reassembled', actorNodeId, {
    description: `${actorName} reassembled IPv4 Datagram from ${datagrams.length} fragments.`,
    packetId: datagram.originalDatagramId ?? datagram.id,
    details: {
      datagram,
      fragments: datagrams,
      fragmentIds: datagrams.map((fragment) => fragment.id),
    },
  })
}

function pathMtuBetweenInterfaces(
  topology: TopologyState,
  sourceInterface: NetworkInterface,
  targetInterface: NetworkInterface,
): number {
  if (
    !sourceInterface.segmentId ||
    sourceInterface.segmentId !== targetInterface.segmentId
  ) {
    return DEFAULT_LINK_MTU
  }

  const pathLinkIds = findSegmentPathLinkIds(
    topology,
    sourceInterface.id,
    targetInterface.id,
    sourceInterface.segmentId,
  )

  if (!pathLinkIds || pathLinkIds.length === 0) {
    return DEFAULT_LINK_MTU
  }

  return Math.min(
    ...pathLinkIds.map((linkId) => {
      const link = topology.links.find((candidate) => candidate.id === linkId)

      return normalizeMtu(link?.mtu)
    }),
  )
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
  const arpReplyFrame = createArpReplyFrame({
    frameId: `${packetId}-arp-reply`,
    senderIp: targetIp,
    senderMac: responder.networkInterface.macAddress,
    targetIp: requesterInterface.ipAddress ?? '0.0.0.0',
    targetMac: requesterInterface.macAddress,
  })

  eventBuilder.add('arp-reply-sent', responder.node.id, {
    description: `${responder.node.name} sent ARP Reply for ${targetIp}.`,
    packetId,
    frameId: arpReplyFrame.id,
    details: {
      ethernetFrame: arpReplyFrame,
      ipAddress: targetIp,
      macAddress: responder.networkInterface.macAddress,
      sourceInterfaceId: responder.networkInterface.id,
      requesterInterfaceId: requesterInterface.id,
    },
  })
  addSwitchForwardingEvents({
    topology,
    segmentId: requesterInterface.segmentId,
    sourceInterface: responder.networkInterface,
    ethernetFrame: arpReplyFrame,
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
  ethernetFrame,
  packetId,
  eventBuilder,
}: {
  topology: TopologyState
  segmentId?: SegmentId
  sourceInterface: NetworkInterface
  ethernetFrame: EthernetFrame
  packetId: string
  eventBuilder: ReturnType<typeof createEventBuilder>
}) {
  if (!segmentId) {
    return
  }

  const sourceMac = ethernetFrame.srcMac
  const destinationMac = ethernetFrame.dstMac
  const destinationInterface =
    destinationMac === BROADCAST_MAC
      ? undefined
      : interfaceByMac(topology, destinationMac)
  const unicastPath =
    destinationInterface?.networkInterface.segmentId === segmentId
      ? findSegmentPathInterfaceIds(
          topology,
          sourceInterface.id,
          destinationInterface.networkInterface.id,
          segmentId,
        )
      : undefined

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
      ingressInterfaceForSwitchPath(segmentInterfaces, unicastPath) ??
      closestSwitchInterface(topology, sourceInterface.id, segmentInterfaces, segmentId)

    if (!ingressInterface) {
      continue
    }

    const decision = processSwitchFrame(
      {
        ...switchNode,
        macAddressTable: eventBuilder.switchMacTable(switchNode),
      },
      ingressInterface.id,
      ethernetFrame,
    )
    eventBuilder.setSwitchMacTable(switchNode.id, decision.macAddressTable)

    eventBuilder.add('switch-frame-received', switchNode.id, {
      description: `${switchNode.name} received Ethernet Frame on ${ingressInterface.name}.`,
      packetId,
      frameId: ethernetFrame.id,
      details: {
        ethernetFrame,
        ingressInterfaceId: ingressInterface.id,
        sourceInterfaceId: sourceInterface.id,
      },
    })
    eventBuilder.add('switch-source-mac-learned', switchNode.id, {
      description: `${switchNode.name} learned source MAC ${sourceMac}.`,
      packetId,
      frameId: ethernetFrame.id,
      details: {
        ethernetFrame,
        ingressInterfaceId: ingressInterface.id,
        sourceInterfaceId: sourceInterface.id,
        macAddress: sourceMac,
        portInterfaceId: ingressInterface.id,
        macAddressTable: [decision.learnedEntry],
      },
    })

    if (decision.kind === 'broadcast-flooded') {
      eventBuilder.add('switch-broadcast-flooded', switchNode.id, {
        description: `${switchNode.name} flooded broadcast Ethernet Frame.`,
        packetId,
        frameId: ethernetFrame.id,
        details: {
          ethernetFrame,
          ingressInterfaceId: ingressInterface.id,
          egressInterfaceIds: decision.egressInterfaceIds,
        },
      })
    } else if (decision.kind === 'unknown-unicast-flooded') {
      eventBuilder.add('switch-unknown-unicast-flooded', switchNode.id, {
        description: `${switchNode.name} flooded unknown unicast Ethernet Frame.`,
        packetId,
        frameId: ethernetFrame.id,
        details: {
          ethernetFrame,
          ingressInterfaceId: ingressInterface.id,
          destinationMac,
          egressInterfaceIds: decision.egressInterfaceIds,
        },
      })
    } else {
      eventBuilder.add('switch-known-unicast-forwarded', switchNode.id, {
        description: `${switchNode.name} forwarded known unicast Ethernet Frame.`,
        packetId,
        frameId: ethernetFrame.id,
        details: {
          ethernetFrame,
          ingressInterfaceId: ingressInterface.id,
          destinationMac,
          egressInterfaceIds: decision.egressInterfaceIds,
        },
      })
    }
  }
}

function ingressInterfaceForSwitchPath(
  segmentInterfaces: NetworkInterface[],
  interfacePath: InterfaceId[] | undefined,
): NetworkInterface | undefined {
  if (!interfacePath) {
    return undefined
  }

  return interfacePath
    .map((interfaceId) =>
      segmentInterfaces.find(
        (networkInterface) => networkInterface.id === interfaceId,
      ),
    )
    .find((networkInterface): networkInterface is NetworkInterface =>
      Boolean(networkInterface),
    )
}

function closestSwitchInterface(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  segmentInterfaces: NetworkInterface[],
  segmentId: SegmentId,
): NetworkInterface | undefined {
  return segmentInterfaces
    .map((networkInterface) => ({
      networkInterface,
      path: findSegmentPathInterfaceIds(
        topology,
        sourceInterfaceId,
        networkInterface.id,
        segmentId,
      ),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        networkInterface: NetworkInterface
        path: InterfaceId[]
      } => Boolean(candidate.path),
    )
    .sort((a, b) => a.path.length - b.path.length)[0]?.networkInterface
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

function findSegmentPathLinkIds(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): LinkId[] | undefined {
  return findSegmentPath(topology, sourceInterfaceId, targetInterfaceId, segmentId)
    ?.pathLinkIds
}

function findSegmentPathInterfaceIds(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): InterfaceId[] | undefined {
  return findSegmentPath(topology, sourceInterfaceId, targetInterfaceId, segmentId)
    ?.pathInterfaceIds
}

function findSegmentPath(
  topology: TopologyState,
  sourceInterfaceId: InterfaceId,
  targetInterfaceId: InterfaceId,
  segmentId: SegmentId,
): { pathInterfaceIds: InterfaceId[]; pathLinkIds: LinkId[] } | undefined {
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

function interfaceByMac(
  topology: TopologyState,
  macAddress: string,
): LocatedInterface | undefined {
  const normalizedMacAddress = normalizeMac(macAddress)

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      if (normalizeMac(networkInterface.macAddress) === normalizedMacAddress) {
        return { node, networkInterface }
      }
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
  const switchMacTables = new Map<string, MacTableEntry[]>()

  return {
    events,
    switchMacTable(switchNode: SwitchNode): MacTableEntry[] {
      return switchMacTables.get(switchNode.id) ?? switchNode.macAddressTable
    },
    setSwitchMacTable(switchNodeId: string, macAddressTable: MacTableEntry[]) {
      switchMacTables.set(switchNodeId, macAddressTable)
    },
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
