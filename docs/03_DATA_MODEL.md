# 03. Data Model

This document defines the TypeScript-oriented domain model.

Names are intentionally explicit because the application is educational.

## 1. Basic ID types

```ts
export type NodeId = string;
export type InterfaceId = string;
export type LinkId = string;
export type SegmentId = string;
export type PacketId = string;
export type FrameId = string;
export type RouteId = string;
```

## 2. Topology state

```ts
export interface TopologyState {
  nodes: NetworkNode[];
  links: NetworkLink[];
  segments: NetworkSegment[];
  settings: LabSettings;
}
```

## 3. Lab settings

```ts
export interface LabSettings {
  autoConfiguration: boolean;
  autoIpAssignment: boolean;
  autoStaticRoutes: boolean;
  manualOverride: boolean;
  blockUnsupportedL2Loops: boolean;
  defaultTtl: number;
  defaultPacketIntervalMs: number;
}
```

Recommended defaults:

```ts
export const DEFAULT_LAB_SETTINGS: LabSettings = {
  autoConfiguration: true,
  autoIpAssignment: true,
  autoStaticRoutes: true,
  manualOverride: true,
  blockUnsupportedL2Loops: true,
  defaultTtl: 64,
  defaultPacketIntervalMs: 500,
};
```

## 4. Node

```ts
export type NodeType = "host" | "switch" | "router";

export interface NetworkNode {
  id: NodeId;
  type: NodeType;
  name: string;
  position: CanvasPosition;
  interfaces: NetworkInterface[];
}

export interface CanvasPosition {
  x: number;
  y: number;
}
```

## 5. Interface

```ts
export interface NetworkInterface {
  id: InterfaceId;
  nodeId: NodeId;
  name: string;

  macAddress: string;

  ipAddress?: string;
  prefixLength?: number;

  segmentId?: SegmentId;
  connectedLinkIds: LinkId[];

  status: InterfaceStatus;

  autoAssigned: boolean;
  manualOverride: boolean;
}

export type InterfaceStatus = "up" | "down";
```

Notes:

- Host and router interfaces can have IP addresses.
- Switch ports usually do not have IP addresses.
- Switch management IP is out of scope.

## 6. Link

```ts
export interface NetworkLink {
  id: LinkId;

  endpointA: LinkEndpoint;
  endpointB: LinkEndpoint;

  status: LinkStatus;

  delayMs: number;
  lossRate: number;
}

export interface LinkEndpoint {
  nodeId: NodeId;
  interfaceId: InterfaceId;
}

export type LinkStatus = "up" | "down";
```

`lossRate` is a number between `0` and `1`.

## 7. Network Segment

```ts
export type SegmentType = "lan" | "point-to-point";

export interface NetworkSegment {
  id: SegmentId;
  name: string;
  type: SegmentType;

  networkAddress: string;
  prefixLength: number;

  defaultGatewayIp?: string;
  primaryRouterInterfaceId?: InterfaceId;

  memberInterfaceIds: InterfaceId[];

  allocationPolicy: IpAllocationPolicy;

  reservedAddresses: string[];

  autoAssigned: boolean;
  manualOverride: boolean;
}

export interface IpAllocationPolicy {
  routerStartOffset: number;
  hostStartOffset: number;
}
```

Recommended allocation policy:

```ts
const LAN_ALLOCATION_POLICY: IpAllocationPolicy = {
  routerStartOffset: 1,
  hostStartOffset: 10,
};
```

## 8. Host configuration

Host data can be derived from the generic node/interface model, but an inspector view can use this shape.

```ts
export interface HostViewModel {
  nodeId: NodeId;
  name: string;
  interface: NetworkInterface;
  defaultGatewayIp?: string;
  arpCache: ArpCacheEntry[];
}
```

Default gateway can be stored either on the host node or as host-specific metadata.

Recommended explicit host node type:

```ts
export interface HostNode extends NetworkNode {
  type: "host";
  defaultGatewayIp?: string;
  arpCache: ArpCacheEntry[];
}
```

If using discriminated unions:

```ts
export type NetworkNode = HostNode | SwitchNode | RouterNode;
```

## 9. Switch node

```ts
export interface SwitchNode extends BaseNetworkNode {
  type: "switch";
  macAddressTable: MacTableEntry[];
}

export interface MacTableEntry {
  macAddress: string;
  portInterfaceId: InterfaceId;
  ageSeconds: number;
}
```

## 10. Router node

```ts
export interface RouterNode extends BaseNetworkNode {
  type: "router";
  routingTable: RouteEntry[];
  arpCache: ArpCacheEntry[];
}
```

## 11. Base node alternative

If TypeScript discriminated unions are preferred:

```ts
export interface BaseNetworkNode {
  id: NodeId;
  name: string;
  position: CanvasPosition;
  interfaces: NetworkInterface[];
}

export interface HostNode extends BaseNetworkNode {
  type: "host";
  defaultGatewayIp?: string;
  arpCache: ArpCacheEntry[];
}

export interface SwitchNode extends BaseNetworkNode {
  type: "switch";
  macAddressTable: MacTableEntry[];
}

export interface RouterNode extends BaseNetworkNode {
  type: "router";
  routingTable: RouteEntry[];
  arpCache: ArpCacheEntry[];
}

export type NetworkNode = HostNode | SwitchNode | RouterNode;
```

## 12. ARP cache

```ts
export interface ArpCacheEntry {
  ipAddress: string;
  macAddress: string;
  interfaceId: InterfaceId;
  ageSeconds: number;
  source: ArpEntrySource;
}

export type ArpEntrySource = "dynamic" | "static";
```

## 13. Routing table

```ts
export type RouteType =
  | "connected"
  | "manual-static"
  | "auto-static"
  | "default";

export interface RouteEntry {
  id: RouteId;

  destinationNetwork: string;
  prefixLength: number;

  nextHopIp?: string;
  outInterfaceId: InterfaceId;

  type: RouteType;
  metric?: number;

  enabled: boolean;

  generatedBy?: "connected-route-generator" | "auto-route-assistant";
  shadowedByRouteId?: RouteId;
}
```

Connected route example:

```ts
{
  id: "route-r1-connected-lan1",
  destinationNetwork: "10.0.1.0",
  prefixLength: 24,
  nextHopIp: undefined,
  outInterfaceId: "r1-g0-0",
  type: "connected",
  enabled: true,
  generatedBy: "connected-route-generator"
}
```

Auto static route example:

```ts
{
  id: "route-r1-to-lan2",
  destinationNetwork: "10.0.2.0",
  prefixLength: 24,
  nextHopIp: "10.255.1.2",
  outInterfaceId: "r1-g0-1",
  type: "auto-static",
  enabled: true,
  generatedBy: "auto-route-assistant"
}
```

## 14. Ethernet frame

```ts
export interface EthernetFrame {
  id: FrameId;

  srcMac: string;
  dstMac: string;

  etherType: EtherType;

  payload: ArpMessage | IPv4Datagram;
}

export type EtherType = "ARP" | "IPv4";
```

Broadcast MAC constant:

```ts
export const BROADCAST_MAC = "FF:FF:FF:FF:FF:FF";
```

## 15. ARP message

```ts
export type ArpOperation = "request" | "reply";

export interface ArpMessage {
  operation: ArpOperation;

  senderIp: string;
  senderMac: string;

  targetIp: string;
  targetMac?: string;
}
```

ARP Request example:

```ts
{
  operation: "request",
  senderIp: "10.0.1.10",
  senderMac: "AA:AA:AA:AA:AA:01",
  targetIp: "10.0.1.1"
}
```

ARP Reply example:

```ts
{
  operation: "reply",
  senderIp: "10.0.1.1",
  senderMac: "AA:AA:AA:AA:FF:01",
  targetIp: "10.0.1.10",
  targetMac: "AA:AA:AA:AA:AA:01"
}
```

## 16. IPv4 datagram

```ts
export interface IPv4Datagram {
  id: PacketId;

  srcIp: string;
  dstIp: string;

  ttl: number;
  protocol: IPv4Protocol;

  payload: IcmpMessage | RawPayload;
}

export type IPv4Protocol = "ICMP" | "RAW";
```

## 17. ICMP

```ts
export type IcmpType =
  | "echo-request"
  | "echo-reply"
  | "time-exceeded"
  | "destination-unreachable";

export interface IcmpMessage {
  type: IcmpType;
  identifier?: number;
  sequenceNumber?: number;
  data?: string;
}
```

MVP requires:

- `echo-request`
- `echo-reply`

Optional later:

- `time-exceeded`
- `destination-unreachable`

## 18. RAW payload

```ts
export interface RawPayload {
  data: string;
}
```

## 19. Packet generator input

```ts
export type PacketType = "icmp-echo" | "generic-ipv4";
export type DestinationMode = "host" | "ip-address";

export interface PacketGeneratorInput {
  sourceHostId: NodeId;

  destinationMode: DestinationMode;
  targetHostId?: NodeId;
  destinationIp?: string;

  packetType: PacketType;

  ttl: number;
  packetCount: number;
  intervalMs: number;

  payload?: string;
}
```

## 20. Simulation state

```ts
export interface SimulationState {
  status: SimulationStatus;
  currentTimeMs: number;
  speed: number;

  eventQueue: SimulationEvent[];
  executedEvents: SimulationEvent[];

  activeFrames: ActiveFrame[];
  activePackets: ActivePacket[];

  packetTraces: PacketTrace[];
}

export type SimulationStatus = "idle" | "running" | "paused" | "completed";
```

## 21. Active frame and packet

```ts
export interface ActiveFrame {
  frame: EthernetFrame;
  currentInterfaceId?: InterfaceId;
  currentLinkId?: LinkId;
  state: "queued" | "moving" | "processing" | "delivered" | "dropped";
}

export interface ActivePacket {
  datagram: IPv4Datagram;
  state: "created" | "in-transit" | "delivered" | "dropped";
  currentNodeId?: NodeId;
  currentInterfaceId?: InterfaceId;
}
```

## 22. Simulation event

```ts
export type SimulationEventType =
  | "host-subnet-check"
  | "host-default-gateway-selected"
  | "arp-cache-hit"
  | "arp-cache-miss"
  | "arp-request-sent"
  | "arp-reply-sent"
  | "arp-cache-updated"
  | "switch-frame-received"
  | "switch-source-mac-learned"
  | "switch-known-unicast-forwarded"
  | "switch-unknown-unicast-flooded"
  | "switch-broadcast-flooded"
  | "router-frame-received"
  | "router-frame-decapsulated"
  | "router-ttl-decremented"
  | "router-route-lookup-started"
  | "router-route-selected"
  | "router-next-hop-selected"
  | "router-frame-encapsulated"
  | "packet-forwarded"
  | "packet-delivered"
  | "packet-dropped";

export interface SimulationEvent {
  id: string;
  timeMs: number;

  type: SimulationEventType;

  actorNodeId?: NodeId;
  actorInterfaceId?: InterfaceId;

  packetId?: PacketId;
  frameId?: FrameId;

  description: string;

  visualAction: VisualAction;

  details?: Record<string, unknown>;
}
```

## 23. Visual action

```ts
export type VisualAction =
  | { type: "none" }
  | {
      type: "move-frame";
      frameId: FrameId;
      fromInterfaceId: InterfaceId;
      toInterfaceId: InterfaceId;
      durationMs: number;
    }
  | {
      type: "flood-frame";
      frameId: FrameId;
      fromInterfaceId: InterfaceId;
      toInterfaceIds: InterfaceId[];
      durationMs: number;
    }
  | { type: "highlight-node"; nodeId: NodeId }
  | { type: "highlight-interface"; interfaceId: InterfaceId }
  | { type: "highlight-route"; routerId: NodeId; routeId: RouteId }
  | { type: "highlight-mac-entry"; switchId: NodeId; macAddress: string }
  | { type: "highlight-arp-entry"; nodeId: NodeId; ipAddress: string }
  | { type: "drop-packet"; packetId: PacketId; reason: PacketDropReason };
```

## 24. Packet trace

```ts
export interface PacketTrace {
  packetId: PacketId;
  packetType: PacketType;
  sourceHostId: NodeId;
  destinationIp: string;
  result: PacketTraceResult;
  events: SimulationEvent[];
}

export type PacketTraceResult =
  | { status: "delivered" }
  | { status: "dropped"; reason: PacketDropReason };
```

## 25. Packet drop reason

```ts
export type PacketDropReason =
  | "No Default Gateway"
  | "No ARP Reply"
  | "No Matching Route"
  | "TTL Expired"
  | "Link Down"
  | "Link Loss"
  | "Invalid Destination MAC"
  | "Interface Down"
  | "Invalid IP Configuration"
  | "Duplicate IP Address"
  | "Duplicate MAC Address"
  | "Network Unreachable"
  | "Unsupported L2 Loop";
```

## 26. Route lookup result

```ts
export interface RouteLookupResult {
  selectedRoute?: RouteEntry;
  candidates: RouteCandidate[];
  reason: "longest-prefix-match" | "no-match";
}

export interface RouteCandidate {
  route: RouteEntry;
  matched: boolean;
  matchLength: number;
  binaryPattern: string;
}
```

## 27. Validation result

```ts
export interface ValidationIssue {
  id: string;
  severity: "info" | "warning" | "error";
  code: ValidationIssueCode;
  message: string;
  relatedNodeIds?: NodeId[];
  relatedInterfaceIds?: InterfaceId[];
  relatedLinkIds?: LinkId[];
  relatedSegmentIds?: SegmentId[];
}

export type ValidationIssueCode =
  | "invalid-ip-address"
  | "invalid-prefix-length"
  | "duplicate-ip-address"
  | "duplicate-mac-address"
  | "gateway-outside-subnet"
  | "link-down"
  | "interface-down"
  | "unsupported-l2-loop";
```

## 28. Persisted state

```ts
export interface PersistedLabState {
  schemaVersion: number;
  topology: TopologyState;
}
```

Runtime-only state should generally not be persisted in shared URLs.

