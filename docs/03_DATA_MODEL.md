# 03. Data Model

This document summarizes the durable domain model. Source of truth is `src/domain/types.ts`.

## Topology

```ts
interface TopologyState {
  nodes: NetworkNode[]
  links: NetworkLink[]
  segments: NetworkSegment[]
  settings: LabSettings
}
```

`NetworkNode` is one of:

- `HostNode`: interfaces, ARP Cache, optional host gateway.
- `SwitchNode`: interfaces, MAC Address Table.
- `RouterNode`: interfaces, Routing Table, ARP Cache.

## Interfaces and Links

```ts
interface NetworkInterface {
  id: InterfaceId
  nodeId: NodeId
  name: string
  macAddress: string
  ipAddress?: string
  prefixLength?: number
  segmentId?: SegmentId
  connectedLinkIds: LinkId[]
  status: 'up' | 'down'
  autoAssigned: boolean
  manualOverride: boolean
}

interface NetworkLink {
  id: LinkId
  endpointA: LinkEndpoint
  endpointB: LinkEndpoint
  status: 'up' | 'down'
  delayMs: number
  lossRate: number
  mtu: number
}
```

## Segments

`NetworkSegment` represents one L2 broadcast domain and one IPv4 subnet allocation unit.

- LAN: `10.0.N.0/24`.
- Router-to-router point-to-point: `10.255.N.0/30`.
- Switches extend a segment.
- Routers separate segments.

## Tables

```ts
interface ArpCacheEntry {
  ipAddress: string
  macAddress: string
  interfaceId: InterfaceId
  ageSeconds: number
  source: 'dynamic' | 'static'
}

interface MacTableEntry {
  macAddress: string
  portInterfaceId: InterfaceId
  ageSeconds: number
}

interface RouteEntry {
  destinationNetwork: string
  prefixLength: number
  nextHopIp?: string
  outInterfaceId: InterfaceId
  type: 'connected' | 'manual-static' | 'auto-static' | 'default'
  metric?: number
  enabled: boolean
}
```

Route selection uses Longest Prefix Match first. Equal-prefix conflicts use:

1. `Connected`
2. `Manual Static`
3. `Auto Static`
4. `Default`

## Packets and Events

Packets are represented as Ethernet frames carrying either ARP messages or IPv4 datagrams. IPv4 datagrams carry ICMP or RAW payload.

`SimulationEvent` is the deterministic trace unit used by:

- Event Log.
- Packet animation.
- Inspector dynamic table highlights.
- Packet detail panels.
- Tests.

Each event should include enough detail to reconstruct relevant UI state without rerunning the simulation.
