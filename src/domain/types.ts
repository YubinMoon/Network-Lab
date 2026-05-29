export type NodeId = string
export type InterfaceId = string
export type LinkId = string
export type SegmentId = string
export type PacketId = string
export type FrameId = string
export type RouteId = string

export interface TopologyState {
  nodes: NetworkNode[]
  links: NetworkLink[]
  segments: NetworkSegment[]
  settings: LabSettings
}

export interface LabSettings {
  autoConfiguration: boolean
  autoIpAssignment: boolean
  autoStaticRoutes: boolean
  manualOverride: boolean
  blockUnsupportedL2Loops: boolean
  defaultTtl: number
  defaultPacketIntervalMs: number
}

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  autoConfiguration: true,
  autoIpAssignment: true,
  autoStaticRoutes: true,
  manualOverride: true,
  blockUnsupportedL2Loops: true,
  defaultTtl: 64,
  defaultPacketIntervalMs: 500,
}

export type NodeType = 'host' | 'switch' | 'router'

export interface CanvasPosition {
  x: number
  y: number
}

export interface BaseNetworkNode {
  id: NodeId
  name: string
  position: CanvasPosition
  interfaces: NetworkInterface[]
}

export interface HostNode extends BaseNetworkNode {
  type: 'host'
  defaultGatewayIp?: string
  arpCache: ArpCacheEntry[]
}

export interface SwitchNode extends BaseNetworkNode {
  type: 'switch'
  macAddressTable: MacTableEntry[]
}

export interface RouterNode extends BaseNetworkNode {
  type: 'router'
  routingTable: RouteEntry[]
  arpCache: ArpCacheEntry[]
}

export type NetworkNode = HostNode | SwitchNode | RouterNode

export interface NetworkInterface {
  id: InterfaceId
  nodeId: NodeId
  name: string
  macAddress: string
  ipAddress?: string
  prefixLength?: number
  segmentId?: SegmentId
  connectedLinkIds: LinkId[]
  status: InterfaceStatus
  autoAssigned: boolean
  manualOverride: boolean
}

export type InterfaceStatus = 'up' | 'down'

export const DEFAULT_LINK_MTU = 1500

export interface NetworkLink {
  id: LinkId
  endpointA: LinkEndpoint
  endpointB: LinkEndpoint
  status: LinkStatus
  delayMs: number
  lossRate: number
  mtu: number
}

export interface LinkEndpoint {
  nodeId: NodeId
  interfaceId: InterfaceId
}

export type LinkStatus = 'up' | 'down'

export type SegmentType = 'lan' | 'point-to-point'

export interface NetworkSegment {
  id: SegmentId
  name: string
  type: SegmentType
  networkAddress: string
  prefixLength: number
  defaultGatewayIp?: string
  primaryRouterInterfaceId?: InterfaceId
  memberInterfaceIds: InterfaceId[]
  allocationPolicy: IpAllocationPolicy
  reservedAddresses: string[]
  autoAssigned: boolean
  manualOverride: boolean
}

export interface IpAllocationPolicy {
  routerStartOffset: number
  hostStartOffset: number
}

export const LAN_ALLOCATION_POLICY: IpAllocationPolicy = {
  routerStartOffset: 1,
  hostStartOffset: 10,
}

export interface MacTableEntry {
  macAddress: string
  portInterfaceId: InterfaceId
  ageSeconds: number
}

export interface ArpCacheEntry {
  ipAddress: string
  macAddress: string
  interfaceId: InterfaceId
  ageSeconds: number
  source: ArpEntrySource
}

export type ArpEntrySource = 'dynamic' | 'static'

export type RouteType =
  | 'connected'
  | 'manual-static'
  | 'auto-static'
  | 'default'

export interface RouteEntry {
  id: RouteId
  destinationNetwork: string
  prefixLength: number
  nextHopIp?: string
  outInterfaceId: InterfaceId
  type: RouteType
  metric?: number
  enabled: boolean
  generatedBy?: 'connected-route-generator' | 'auto-route-assistant'
  shadowedByRouteId?: RouteId
}

export interface EthernetFrame {
  id: FrameId
  srcMac: string
  dstMac: string
  etherType: EtherType
  payload: ArpMessage | IPv4Datagram
}

export type EtherType = 'ARP' | 'IPv4'

export const BROADCAST_MAC = 'FF:FF:FF:FF:FF:FF'

export type ArpOperation = 'request' | 'reply'

export interface ArpMessage {
  operation: ArpOperation
  senderIp: string
  senderMac: string
  targetIp: string
  targetMac?: string
}

export interface IPv4Datagram {
  id: PacketId
  identification: string
  srcIp: string
  dstIp: string
  ttl: number
  protocol: IPv4Protocol
  dontFragment: boolean
  moreFragments: boolean
  fragmentOffset: number
  fragmentPayloadLength?: number
  originalDatagramId?: PacketId
  payload: IcmpMessage | RawPayload
}

export type IPv4Protocol = 'ICMP' | 'RAW'

export type IcmpType =
  | 'echo-request'
  | 'echo-reply'
  | 'time-exceeded'
  | 'destination-unreachable'

export interface IcmpMessage {
  type: IcmpType
  identifier?: number
  sequenceNumber?: number
  data?: string
}

export interface RawPayload {
  data: string
}

export type PacketType = 'icmp-echo' | 'generic-ipv4'
export type DestinationMode = 'host' | 'ip-address'

export interface PacketGeneratorInput {
  sourceHostId: NodeId
  destinationMode: DestinationMode
  targetHostId?: NodeId
  destinationIp?: string
  packetType: PacketType
  ttl: number
  packetCount: number
  intervalMs: number
  payload?: string
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'completed'

export type SimulationEventType =
  | 'host-subnet-check'
  | 'host-default-gateway-selected'
  | 'arp-cache-hit'
  | 'arp-cache-miss'
  | 'arp-request-sent'
  | 'arp-reply-sent'
  | 'arp-cache-updated'
  | 'switch-frame-received'
  | 'switch-source-mac-learned'
  | 'switch-known-unicast-forwarded'
  | 'switch-unknown-unicast-flooded'
  | 'switch-broadcast-flooded'
  | 'router-frame-received'
  | 'router-frame-decapsulated'
  | 'router-ttl-decremented'
  | 'router-route-lookup-started'
  | 'router-route-selected'
  | 'router-next-hop-selected'
  | 'ipv4-datagram-fragmented'
  | 'ipv4-fragments-reassembled'
  | 'router-frame-encapsulated'
  | 'packet-forwarded'
  | 'packet-delivered'
  | 'packet-dropped'

export interface SimulationEvent {
  id: string
  timeMs: number
  type: SimulationEventType
  actorNodeId?: NodeId
  actorInterfaceId?: InterfaceId
  packetId?: PacketId
  frameId?: FrameId
  description: string
  visualAction: VisualAction
  details?: Record<string, unknown>
}

export type VisualAction =
  | { type: 'none' }
  | {
      type: 'move-frame'
      frameId: FrameId
      fromInterfaceId: InterfaceId
      toInterfaceId: InterfaceId
      durationMs: number
    }
  | {
      type: 'flood-frame'
      frameId: FrameId
      fromInterfaceId: InterfaceId
      toInterfaceIds: InterfaceId[]
      durationMs: number
    }
  | { type: 'highlight-node'; nodeId: NodeId }
  | { type: 'highlight-interface'; interfaceId: InterfaceId }
  | { type: 'highlight-route'; routerId: NodeId; routeId: RouteId }
  | { type: 'highlight-mac-entry'; switchId: NodeId; macAddress: string }
  | { type: 'highlight-arp-entry'; nodeId: NodeId; ipAddress: string }
  | { type: 'drop-packet'; packetId: PacketId; reason: PacketDropReason }

export interface PacketTrace {
  packetId: PacketId
  packetType: PacketType
  sourceHostId: NodeId
  destinationIp: string
  result: PacketTraceResult
  events: SimulationEvent[]
}

export type PacketTraceResult =
  | { status: 'delivered' }
  | { status: 'dropped'; reason: PacketDropReason }

export type PacketDropReason =
  | 'No Default Gateway'
  | 'No ARP Reply'
  | 'No Matching Route'
  | 'TTL Expired'
  | 'Link Down'
  | 'Link Loss'
  | 'Invalid Destination MAC'
  | 'Interface Down'
  | 'Invalid IP Configuration'
  | 'Duplicate IP Address'
  | 'Duplicate MAC Address'
  | 'Network Unreachable'
  | 'Fragmentation Needed'
  | 'MTU Too Small'
  | 'Unsupported L2 Loop'

export interface RouteLookupResult {
  selectedRoute?: RouteEntry
  candidates: RouteCandidate[]
  reason: 'longest-prefix-match' | 'no-match'
}

export interface RouteCandidate {
  route: RouteEntry
  matched: boolean
  matchLength: number
  binaryPattern: string
}

export interface ValidationIssue {
  id: string
  severity: 'info' | 'warning' | 'error'
  code: ValidationIssueCode
  message: string
  relatedNodeIds?: NodeId[]
  relatedInterfaceIds?: InterfaceId[]
  relatedLinkIds?: LinkId[]
  relatedSegmentIds?: SegmentId[]
}

export type ValidationIssueCode =
  | 'invalid-ip-address'
  | 'invalid-prefix-length'
  | 'duplicate-ip-address'
  | 'duplicate-mac-address'
  | 'gateway-outside-subnet'
  | 'link-down'
  | 'interface-down'
  | 'unsupported-l2-loop'

export interface PersistedLabState {
  schemaVersion: number
  topology: TopologyState
}
