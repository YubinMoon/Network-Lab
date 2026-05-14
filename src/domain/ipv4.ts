import { lookupRoute } from './routing'
import type {
  EthernetFrame,
  IPv4Datagram,
  NetworkInterface,
  PacketDropReason,
  RouteEntry,
  RouterNode,
} from './types'

export interface RouterForwardingResult {
  status: 'forwarded' | 'dropped'
  previousTtl?: number
  datagram?: IPv4Datagram
  selectedRoute?: RouteEntry
  nextHopIp?: string
  outInterface?: NetworkInterface
  frame?: EthernetFrame
  reason?: PacketDropReason
}

export function createIpv4Datagram({
  id,
  srcIp,
  dstIp,
  ttl,
  payload,
}: {
  id: string
  srcIp: string
  dstIp: string
  ttl: number
  payload: IPv4Datagram['payload']
}): IPv4Datagram {
  return {
    id,
    srcIp,
    dstIp,
    ttl,
    protocol: 'RAW',
    payload,
  }
}

export function createIpv4Frame({
  frameId,
  srcMac,
  dstMac,
  datagram,
}: {
  frameId: string
  srcMac: string
  dstMac: string
  datagram: IPv4Datagram
}): EthernetFrame {
  return {
    id: frameId,
    srcMac,
    dstMac,
    etherType: 'IPv4',
    payload: datagram,
  }
}

export function forwardIpv4FrameAtRouter({
  router,
  ingressInterfaceId,
  frame,
  resolveMacForIp,
  frameId,
}: {
  router: RouterNode
  ingressInterfaceId: string
  frame: EthernetFrame
  resolveMacForIp: (ipAddress: string) => string | undefined
  frameId: string
}): RouterForwardingResult {
  const ingressInterface = router.interfaces.find(
    (networkInterface) => networkInterface.id === ingressInterfaceId,
  )

  if (!ingressInterface || ingressInterface.status === 'down') {
    return { status: 'dropped', reason: 'Interface Down' }
  }

  if (frame.dstMac !== ingressInterface.macAddress) {
    return { status: 'dropped', reason: 'Invalid Destination MAC' }
  }

  if (frame.etherType !== 'IPv4') {
    return { status: 'dropped', reason: 'Invalid IP Configuration' }
  }

  const datagram = frame.payload as IPv4Datagram
  const previousTtl = datagram.ttl
  const decrementedDatagram = {
    ...datagram,
    ttl: datagram.ttl - 1,
  }

  if (decrementedDatagram.ttl <= 0) {
    return {
      status: 'dropped',
      previousTtl,
      datagram: decrementedDatagram,
      reason: 'TTL Expired',
    }
  }

  const routeLookup = lookupRoute(datagram.dstIp, router.routingTable)
  const selectedRoute = routeLookup.selectedRoute

  if (!selectedRoute) {
    return {
      status: 'dropped',
      previousTtl,
      datagram: decrementedDatagram,
      reason: 'No Matching Route',
    }
  }

  const outInterface = router.interfaces.find(
    (networkInterface) => networkInterface.id === selectedRoute.outInterfaceId,
  )

  if (!outInterface || outInterface.status === 'down') {
    return {
      status: 'dropped',
      previousTtl,
      datagram: decrementedDatagram,
      selectedRoute,
      reason: 'Interface Down',
    }
  }

  const nextHopIp = selectedRoute.nextHopIp ?? datagram.dstIp
  const nextHopMac = resolveMacForIp(nextHopIp)

  if (!nextHopMac) {
    return {
      status: 'dropped',
      previousTtl,
      datagram: decrementedDatagram,
      selectedRoute,
      nextHopIp,
      outInterface,
      reason: 'No ARP Reply',
    }
  }

  const nextFrame = createIpv4Frame({
    frameId,
    srcMac: outInterface.macAddress,
    dstMac: nextHopMac,
    datagram: decrementedDatagram,
  })

  return {
    status: 'forwarded',
    previousTtl,
    datagram: decrementedDatagram,
    selectedRoute,
    nextHopIp,
    outInterface,
    frame: nextFrame,
  }
}
