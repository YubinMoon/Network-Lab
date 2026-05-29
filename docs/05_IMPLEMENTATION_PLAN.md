# 05. Implementation Plan

This document defines the implementation phases for Codex.

## Phase 0. Project bootstrap

### Goal

Create a Vite + React + TypeScript project and install core dependencies.

### Tasks

```bash
npm create vite@latest ipv4-network-lab -- --template react-ts
cd ipv4-network-lab
npm install @xyflow/react zustand lz-string nanoid clsx
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### Deliverables

- App boots in browser.
- TypeScript strict mode enabled.
- Basic project folders created.
- Test runner configured.

### Acceptance

```bash
npm run dev
npm run test
npm run build
```

All commands should succeed.

---

## Phase 1. Domain utilities and data model

### Goal

Create pure TypeScript domain model and utility functions.

### Files

```text
src/domain/types.ts
src/domain/ip.ts
src/domain/mac.ts
src/domain/validation.ts
src/tests/ip.test.ts
```

### Required utilities

IPv4:

- `parseIpv4(ip: string): number`
- `formatIpv4(value: number): string`
- `isValidIpv4(ip: string): boolean`
- `isValidPrefixLength(prefix: number): boolean`
- `networkAddress(ip: string, prefix: number): string`
- `broadcastAddress(ip: string, prefix: number): string`
- `ipMatchesPrefix(ip: string, network: string, prefix: number): boolean`
- `toBinaryIpv4(ip: string): string`
- `toBinaryPrefixPattern(network: string, prefix: number): string`
- `hostAddressFromOffset(network: string, prefix: number, offset: number): string`

MAC:

- `isValidMac(mac: string): boolean`
- `normalizeMac(mac: string): string`
- `generateMac(seed?: string): string`
- `isBroadcastMac(mac: string): boolean`

### Acceptance

Unit tests must cover:

- `/24` network address calculation.
- `/30` network address calculation.
- Prefix matching.
- Binary formatting.
- Invalid IPv4 input.
- Invalid prefix length.
- MAC validation.

---

## Phase 2. Topology store and basic editor

### Goal

Create basic state store and canvas editor.

### Files

```text
src/store/useLabStore.ts
src/components/canvas/NetworkCanvas.tsx
src/components/canvas/HostNode.tsx
src/components/canvas/SwitchNode.tsx
src/components/canvas/RouterNode.tsx
src/components/canvas/LinkEdge.tsx
src/components/inspector/Inspector.tsx
```

### Features

- Add Host.
- Add Switch.
- Add Router.
- Connect nodes with Link.
- Move nodes.
- Delete nodes and links.
- Select object and show Inspector.
- Show basic node labels and interface labels.

### Default node behavior

Host:

```text
Name: Host A, Host B, ...
Interface: eth0
```

Switch:

```text
Name: Switch S1, Switch S2, ...
Ports added as links are connected or pre-created e0/1..e0/8.
```

Router:

```text
Name: Router R1, Router R2, ...
Interfaces g0/0, g0/1, ...
```

### Acceptance

The user can create this topology visually:

```text
Host A ─ Switch S1 ─ Router R1 ─ Switch S2 ─ Host B
```

---

## Phase 3. Network Segment detection

### Goal

Automatically detect Layer 2 broadcast domains.

### Files

```text
src/domain/graph.ts
src/domain/segments.ts
src/domain/autoConfig.ts
src/tests/segments.test.ts
```

### Implementation

Use interface graph connected components:

- Physical links connect endpoint interfaces.
- Switch ports are internally connected.
- Router interfaces are not internally connected.
- Host interfaces are not forwarding interfaces.

### Required scenarios

Scenario 1:

```text
Host A ─ Switch S1 ─ Host B
```

Expected:

```text
1 Network Segment
Type: lan
Members: Host A eth0, Host B eth0, Switch S1 ports
```

Scenario 2:

```text
Host A ─ Switch S1 ─ Router R1 ─ Switch S2 ─ Host B
```

Expected:

```text
2 Network Segments
LAN-1: Host A side
LAN-2: Host B side
```

Scenario 3:

```text
Router R1 ─ Router R2
```

Expected:

```text
1 Network Segment
Type: point-to-point
```

### Acceptance

- Segment objects are visible in Inspector.
- Canvas can visually mark segment boundaries or show segment labels.
- Segment identity is preserved when possible after minor edits.

---

## Phase 4. Auto IP/MAC/Gateway assignment

### Goal

Let users build networks without manual configuration.

### Files

```text
src/domain/autoConfig.ts
src/domain/validation.ts
src/tests/autoConfig.test.ts
```

### Required behavior

When a new LAN segment is detected:

```text
CIDR: 10.0.N.0/24
```

When a new router-to-router point-to-point segment is detected:

```text
CIDR: 10.255.N.0/30
```

When a host joins a LAN segment:

```text
Host IP: segment host offset .10, .11, ...
Prefix: segment prefix
Default Gateway: first router interface IP in segment, if present
```

When a router interface joins a segment:

```text
Router IP: segment router offset .1, .2, ...
Prefix: segment prefix
```

When a segment CIDR is edited:

- Update member interface IPs unless manually overridden.
- Update host default gateway.
- Update connected routes.
- Update auto static routes.

### Acceptance

For topology:

```text
Host A ─ Switch S1 ─ Router R1 ─ Switch S2 ─ Host B
```

Expected default config:

```text
LAN-1: 10.0.1.0/24
Host A eth0: 10.0.1.10/24
R1 g0/0: 10.0.1.1/24
Host A Default Gateway: 10.0.1.1

LAN-2: 10.0.2.0/24
R1 g0/1: 10.0.2.1/24
Host B eth0: 10.0.2.10/24
Host B Default Gateway: 10.0.2.1
```

---

## Phase 5. Connected and Auto Static routes

### Goal

Generate routing tables automatically while preserving static-routing semantics.

### Files

```text
src/domain/routing.ts
src/tests/routing.test.ts
```

### Connected route generation

For every router interface with IP/prefix:

```text
Destination = network address
Prefix = prefix length
Next Hop = connected
Out Interface = interface
Type = Connected
```

### Auto Static route generation

Build router graph and generate static routes to reachable non-local segments.

### UI display

Routing Table columns:

```text
Destination | Prefix | Next Hop | Out Interface | Type | Metric | Status
```

Example:

```text
10.0.1.0    /24    connected    g0/0    Connected     -    Enabled
10.0.2.0    /24    connected    g0/1    Connected     -    Enabled
```

For multi-router topology:

```text
10.0.3.0    /24    10.255.1.2   g0/1    Auto Static   -    Enabled
```

### Acceptance

Given:

```text
Host A ─ LAN-1 ─ R1 ─ P2P-1 ─ R2 ─ LAN-2 ─ Host B
```

Expected:

R1 route to LAN-2:

```text
Destination: 10.0.2.0/24
Next Hop: R2 IP on P2P-1
Out Interface: R1 interface on P2P-1
Type: Auto Static
```

R2 route to LAN-1:

```text
Destination: 10.0.1.0/24
Next Hop: R1 IP on P2P-1
Out Interface: R2 interface on P2P-1
Type: Auto Static
```

---

## Phase 6. Layer 2 switching

### Goal

Implement Ethernet frame forwarding and MAC learning.

### Files

```text
src/domain/l2.ts
src/tests/l2.test.ts
```

### Behavior

Switch receives Ethernet frame:

1. Learn source MAC on ingress port.
2. If broadcast, flood all ports except ingress.
3. If destination MAC known, forward to mapped port.
4. If unknown, flood all ports except ingress.

### UI requirements

- MAC Address Table visible in Switch Inspector.
- New entries highlighted.
- Forwarded/flooded frames animated.

### Acceptance

Same LAN example:

```text
Host A ─ Switch S1 ─ Host B
```

Host A sends ARP Request:

- Switch learns Host A MAC.
- Switch floods broadcast frame.

Host B replies:

- Switch learns Host B MAC.
- Switch forwards ARP Reply only to Host A port if Host A MAC is known.

---

## Phase 7. ARP simulation

### Goal

Implement ARP request/reply and cache behavior.

### Files

```text
src/domain/arp.ts
src/tests/arp.test.ts
```

### Behavior

- ARP cache hit skips ARP exchange.
- ARP cache miss creates ARP Request.
- ARP Request is broadcast.
- Matching interface sends ARP Reply.
- ARP Reply is unicast.
- Receiver updates ARP Cache.

### Acceptance

External network case:

```text
Host A: 10.0.1.10/24
Default Gateway: 10.0.1.1
Destination: 10.0.2.10
```

Expected:

```text
Host A ARPs for 10.0.1.1, not 10.0.2.10.
```

---

## Phase 8. IPv4 forwarding simulation

### Goal

Implement host sending, router forwarding, TTL, routing lookup, and packet drops.

### Files

```text
src/domain/ipv4.ts
src/domain/simulation.ts
src/tests/simulation.test.ts
```

### Behavior

Host sending:

- Same subnet: ARP for destination.
- Different subnet: ARP for default gateway.
- No gateway: drop with `No Default Gateway`.

Router forwarding:

- Verify destination MAC.
- Decapsulate IPv4.
- Decrement TTL.
- Drop if TTL becomes zero.
- Lookup route by Longest Prefix Match.
- Drop if no route.
- ARP for next hop.
- Re-encapsulate and forward.

### Acceptance

Packet from Host A to Host B across one router:

- Source IP unchanged.
- Destination IP unchanged.
- TTL decremented at router.
- Source MAC changes after router.
- Destination MAC changes after router.

---

## Phase 9. ICMP Echo and Generic IPv4 packets

### Goal

Support ping and raw IPv4 datagram demo.

### Files

```text
src/domain/icmp.ts
src/components/simulation/PacketGenerator.tsx
```

### ICMP Echo behavior

- Source host sends ICMP Echo Request.
- Destination host delivers it.
- Destination host generates ICMP Echo Reply.
- Reply follows normal host sending process.

### Generic IPv4 behavior

- Source host sends RAW datagram.
- Destination host delivers payload.
- No reply generated.

### Acceptance

Packet Generator can send:

```text
ICMP Echo
Generic IPv4 Packet
```

---

## Phase 10. Animation and simulation panels

### Goal

Make packet flow visually inspectable.

### Files

```text
src/components/canvas/PacketToken.tsx
src/components/simulation/SimulationControls.tsx
src/components/simulation/EventLog.tsx
src/components/simulation/LayerView.tsx
src/components/simulation/PacketDetail.tsx
src/components/simulation/BinaryMatchView.tsx
src/components/simulation/Timeline.tsx
```

### Required panels

- Event Log.
- Layer View.
- Packet Detail.
- Binary Match.
- Timeline.

### Controls

```text
Play
Pause
Next Event
Previous Event
Reset
Speed: 0.5x | 1x | 2x | 4x
```

### Acceptance

A user can slow down the simulation and inspect route lookup at the router.

---

## Phase 11. URL state and export/import

### Goal

Allow topology sharing without backend.

### Files

```text
src/persistence/urlState.ts
src/persistence/schemaVersion.ts
```

### Required behavior

- Export topology to JSON.
- Import topology from JSON.
- Create share URL with compressed state.
- Load topology from share URL.

### Encoding

```text
JSON.stringify(persistedState)
→ compressToEncodedURIComponent
→ #state=<encoded>
```

### Acceptance

User can copy URL, open it in another tab, and get the same topology.

---

## Phase 12. Examples

### Goal

Add prebuilt examples for learning and testing.

### Files

```text
src/examples/topologies.ts
```

### Required examples

1. Same LAN Communication.
2. ARP Cache Hit vs Miss.
3. Switch MAC Learning.
4. Default Gateway Forwarding.
5. Router-to-Router Forwarding.
6. Longest Prefix Match.
7. No Matching Route.
8. TTL Expired Loop.
9. Link Loss and Unreliable Delivery.
10. Multiple Datagrams and Connectionless Delivery.

### Acceptance

Each example loads from a menu and can be simulated immediately.

---

## Phase 13. Polish and validation

### Goal

Improve usability and correctness.

### Tasks

- Add validation warnings.
- Add unsupported L2 loop detection.
- Add better inspector tables.
- Add route shadowing display.
- Add reset dynamic tables button.
- Add clear event log button.
- Add selected field highlights.

### Acceptance

The app is stable for small educational topologies of roughly:

```text
Hosts: 2-10
Switches: 1-5
Routers: 1-5
Links: 2-20
```
