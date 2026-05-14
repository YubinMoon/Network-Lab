# 02. Architecture

## 1. Architecture overview

The application should be split into four main layers.

```text
React UI Layer
├─ Canvas
├─ Inspector
├─ Simulation Panel
├─ Packet Generator
└─ Share/Import/Export UI

State Layer
├─ Topology state
├─ Selection state
├─ Simulation state
├─ Animation state
└─ Persistence state

Domain Layer
├─ IP utilities
├─ MAC utilities
├─ Network Segment detection
├─ Auto configuration
├─ Routing table generation
├─ L2 switching
├─ ARP
├─ IPv4 forwarding
└─ Simulation event engine

Persistence Layer
├─ URL hash state
├─ Local Storage
├─ Export JSON
└─ Import JSON
```

The most important rule is that networking logic must live in the domain layer, not in React components.

## 2. Recommended module layout

```text
src/
├─ components/
│  ├─ canvas/
│  │  ├─ NetworkCanvas.tsx
│  │  ├─ HostNode.tsx
│  │  ├─ SwitchNode.tsx
│  │  ├─ RouterNode.tsx
│  │  ├─ LinkEdge.tsx
│  │  └─ PacketToken.tsx
│  ├─ inspector/
│  │  ├─ Inspector.tsx
│  │  ├─ HostInspector.tsx
│  │  ├─ SwitchInspector.tsx
│  │  ├─ RouterInspector.tsx
│  │  ├─ SegmentInspector.tsx
│  │  └─ PacketInspector.tsx
│  ├─ simulation/
│  │  ├─ SimulationControls.tsx
│  │  ├─ EventLog.tsx
│  │  ├─ LayerView.tsx
│  │  ├─ PacketDetail.tsx
│  │  ├─ BinaryMatchView.tsx
│  │  └─ Timeline.tsx
│  └─ common/
│     ├─ Table.tsx
│     ├─ Panel.tsx
│     └─ Field.tsx
│
├─ domain/
│  ├─ types.ts
│  ├─ ip.ts
│  ├─ mac.ts
│  ├─ graph.ts
│  ├─ segments.ts
│  ├─ autoConfig.ts
│  ├─ routing.ts
│  ├─ l2.ts
│  ├─ arp.ts
│  ├─ ipv4.ts
│  ├─ icmp.ts
│  ├─ simulation.ts
│  └─ validation.ts
│
├─ store/
│  └─ useLabStore.ts
│
├─ persistence/
│  ├─ urlState.ts
│  ├─ localStorage.ts
│  └─ schemaVersion.ts
│
├─ examples/
│  └─ topologies.ts
│
└─ tests/
   ├─ ip.test.ts
   ├─ segments.test.ts
   ├─ routing.test.ts
   ├─ l2.test.ts
   ├─ arp.test.ts
   └─ simulation.test.ts
```

## 3. State separation

Use three different state categories.

### 3.1 Persistent topology state

This is saved to URL/local storage/export JSON.

Includes:

- Nodes.
- Links.
- Network Segments.
- Interface configuration.
- Routing table entries.
- ARP/MAC tables if user chooses to preserve runtime state. For default sharing, runtime tables can be omitted.
- Settings.

### 3.2 Runtime simulation state

This is recreated when simulation starts.

Includes:

- Active packets.
- Frames in motion.
- Event queue.
- Event log.
- Current simulation time.
- Packet traces.
- Dynamic ARP cache entries.
- Dynamic switch MAC table entries.

### 3.3 UI-only state

This does not need to be shared.

Includes:

- Selected object.
- Open panels.
- Zoom/pan viewport.
- Hover state.
- Animation progress.

## 4. Network Segment detection

### 4.1 Segment definition

A `Network Segment` is a connected Layer 2 broadcast domain.

Segment traversal rules:

```text
Physical links connect interfaces.
Switch interfaces are internally connected to each other.
Router interfaces are not internally connected to each other.
Host interfaces are not forwarding interfaces.
```

### 4.2 Interface graph algorithm

Build a graph where vertices are interfaces.

Add graph edges:

1. For every physical link, add an edge between the two endpoint interfaces.
2. For every switch, add internal edges between all switch ports.
3. Do not add internal edges between router interfaces.
4. Do not add internal forwarding edges between host interfaces.

Then compute connected components.

Each connected component is a `Network Segment`.

Pseudo-code:

```ts
function detectSegments(nodes: NetworkNode[], links: NetworkLink[]): NetworkSegmentDraft[] {
  const graph = new InterfaceGraph();

  for (const node of nodes) {
    for (const iface of node.interfaces) {
      graph.addVertex(iface.id);
    }
  }

  for (const link of links) {
    if (link.status === "up") {
      graph.addEdge(link.endpointA.interfaceId, link.endpointB.interfaceId, "physical-link");
    }
  }

  for (const node of nodes) {
    if (node.type === "switch") {
      for (const a of node.interfaces) {
        for (const b of node.interfaces) {
          if (a.id !== b.id) {
            graph.addEdge(a.id, b.id, "switch-internal-forwarding");
          }
        }
      }
    }
  }

  return graph.connectedComponents().map(component => createSegmentDraft(component));
}
```

### 4.3 Segment classification

Classify a segment as `point-to-point` when:

```text
- It has exactly two member interfaces.
- Both interfaces belong to routers.
- There is no switch inside the segment.
```

Otherwise classify as `lan`.

### 4.4 Segment identity preservation

When topology changes, try to preserve existing segment IDs and user-edited CIDRs.

Heuristic:

1. Compute new segment member sets.
2. Compare with old segments by maximum member overlap.
3. Reuse the old segment ID and CIDR if overlap is strong.
4. Create new segment ID only for genuinely new segments.

This avoids resetting addresses every time the user slightly moves or reconnects a link.

## 5. Auto IP assignment

### 5.1 Default CIDR generation

LAN segment:

```text
10.0.N.0/24
```

Point-to-point segment:

```text
10.255.N.0/30
```

`N` should be the lowest unused positive integer.

### 5.2 Assignment strategy

For every segment:

1. Assign router interfaces first.
2. Assign host interfaces second.
3. Switch ports do not need IP addresses.
4. Preserve manual overrides.
5. Avoid network address and broadcast address.
6. Avoid duplicates.

LAN allocation:

```text
Router offsets: 1, 2, 3, ...
Host offsets: 10, 11, 12, ...
```

Point-to-point allocation:

```text
Router A: first usable address
Router B: second usable address
```

### 5.3 Gateway selection

For each LAN segment:

- If there is at least one router interface, the first router interface becomes the primary gateway.
- Host default gateway becomes that router interface IP.
- If there is no router interface, host default gateway is `none`.

If multiple router interfaces exist in one LAN, show the selected gateway explicitly.

## 6. Connected route generation

For each router interface with an IP address and prefix:

```text
Destination = network address of interface IP/prefix
Prefix = interface prefix
Next Hop = connected
Out Interface = interface
Type = Connected
```

Connected routes are not user-created static routes. They exist because the router has an interface in that network.

## 7. Auto Static Route generation

### 7.1 Purpose

Auto Static routes are generated by the application to reduce repetitive manual configuration.

They are still static route entries.

They must be displayed as:

```text
Type: Auto Static
Generated by: Auto Route Assistant
```

### 7.2 Router graph

Create a graph where vertices are routers.

Router graph edges are created from network segments that contain two or more router interfaces.

For each segment with routers:

- Connect every pair of routers in that segment.
- Store local interface ID.
- Store peer router interface IP as possible `nextHopIp`.

### 7.3 Destination segments

Every segment that has an IP subnet can be a routing destination.

For each router `R`, generate routes to destination segments that are:

- Not directly connected to `R`.
- Reachable through the router graph.

### 7.4 Shortest path route generation

For each router `R` and each destination segment `S`:

1. Find routers directly connected to `S`.
2. Find the shortest path from `R` to any router attached to `S`.
3. Use the first hop router as next hop.
4. Use the local interface connecting `R` to that first hop as out interface.
5. Add an `Auto Static` route to `S`.

Pseudo-code:

```ts
function generateAutoStaticRoutes(topology: TopologyState): RouteEntry[] {
  const routerGraph = buildRouterGraph(topology);
  const destinationSegments = topology.segments.filter(hasIpSubnet);
  const routes: RouteEntry[] = [];

  for (const router of getRouters(topology)) {
    const connectedSegmentIds = getConnectedSegmentIds(router);

    for (const segment of destinationSegments) {
      if (connectedSegmentIds.has(segment.id)) continue;

      const targetRouters = getRoutersConnectedToSegment(segment.id);
      const path = shortestPathToAny(router.id, targetRouters, routerGraph);
      if (!path) continue;

      const firstHop = path[1];
      const edge = routerGraph.getEdge(router.id, firstHop);

      routes.push({
        id: createId(),
        destinationNetwork: segment.networkAddress,
        prefixLength: segment.prefixLength,
        nextHopIp: edge.peerInterfaceIp,
        outInterfaceId: edge.localInterfaceId,
        type: "auto-static",
        enabled: true,
      });
    }
  }

  return routes;
}
```

### 7.5 Manual route override

If a user creates a `Manual Static` route for the same destination/prefix, it should override the `Auto Static` route in equal-prefix selection.

Do not delete the auto route automatically. Either:

- Disable conflicting auto route, or
- Keep it but mark it as shadowed.

Recommended display:

```text
Auto Static route shadowed by Manual Static route
```

## 8. Routing lookup algorithm

Input:

- Destination IP.
- Router routing table.

Steps:

1. Filter enabled route entries.
2. Check which entries match the destination IP/prefix.
3. Choose the entry with the longest prefix length.
4. If equal prefix length, use type precedence.
5. If still tied, use lower metric.
6. If still tied, use stable insertion order.
7. If no route matches, drop with `No Matching Route`.

Return:

- Selected route.
- Candidate route comparison details.
- Binary prefix match explanation.

## 9. Simulation engine

### 9.1 Event-driven simulation

The simulation must be event-driven.

An animation is a visual representation of simulation events, not the source of truth.

Example events:

```text
host-subnet-check
host-default-gateway-selected
arp-cache-hit
arp-cache-miss
arp-request-sent
arp-reply-sent
arp-cache-updated
switch-frame-received
switch-source-mac-learned
switch-broadcast-flooded
switch-known-unicast-forwarded
router-frame-received
router-frame-decapsulated
router-ttl-decremented
router-route-lookup-started
router-route-selected
router-next-hop-selected
router-frame-encapsulated
packet-forwarded
packet-delivered
packet-dropped
```

### 9.2 Event object

Every event should include enough data for log rendering, animation, and panel highlighting.

```ts
interface SimulationEvent {
  id: string;
  timeMs: number;
  type: SimulationEventType;
  actorNodeId?: string;
  actorInterfaceId?: string;
  packetId?: string;
  frameId?: string;
  description: string;
  visualAction: VisualAction;
  details?: Record<string, unknown>;
}
```

## 10. Animation architecture

The animation system should subscribe to simulation events.

Recommended visual actions:

```ts
type VisualAction =
  | { type: "none" }
  | { type: "move-frame"; frameId: string; fromInterfaceId: string; toInterfaceId: string; durationMs: number }
  | { type: "flood-frame"; frameId: string; fromInterfaceId: string; toInterfaceIds: string[]; durationMs: number }
  | { type: "highlight-node"; nodeId: string }
  | { type: "highlight-interface"; interfaceId: string }
  | { type: "highlight-route"; routerId: string; routeId: string }
  | { type: "highlight-mac-entry"; switchId: string; macAddress: string }
  | { type: "highlight-arp-entry"; nodeId: string; ipAddress: string }
  | { type: "drop-packet"; packetId: string; reason: PacketDropReason };
```

## 11. Validation architecture

Run validation whenever topology or configuration changes.

Validation should detect:

- Invalid IP address.
- Invalid prefix length.
- Duplicate IP address.
- Duplicate MAC address.
- Gateway outside host subnet.
- Missing gateway when external routing is attempted.
- Link connected to invalid interface.
- Interface down.
- Unsupported L2 loop.

Validation results should be visible in the UI and used by simulation.

## 12. Persistence architecture

### 12.1 URL state

Encoding pipeline:

```text
TopologyState
→ remove runtime-only state
→ JSON.stringify
→ compressToEncodedURIComponent
→ set location.hash = #state=<value>
```

Decoding pipeline:

```text
Read location.hash
→ extract state value
→ decompressFromEncodedURIComponent
→ JSON.parse
→ validate schema version
→ migrate if needed
→ load topology state
```

### 12.2 Schema versioning

Persisted state must contain:

```ts
interface PersistedLabState {
  schemaVersion: number;
  topology: TopologyState;
}
```

Add migration functions for future changes.

