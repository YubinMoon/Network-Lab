# 01. Product Specification

## 1. Product name

Working name:

```text
IPv4 Network Visualization Lab
```

Alternative names:

```text
IPv4 Packet Visualizer
L2/L3 Network Lab
Network Datagram Lab
```

## 2. Product goal

Create a browser-only educational simulator that lets undergraduate computer networking students visually inspect how packets move through Layer 2 and Layer 3.

The application should help students understand:

- Why ARP is needed.
- How a switch learns MAC addresses.
- Why a router uses IP addresses, not MAC addresses, for forwarding decisions.
- Why Ethernet headers are rewritten at each hop.
- Why source IP and destination IP stay the same during normal forwarding.
- How a routing table is searched.
- How Longest Prefix Match works.
- Why TTL exists.
- Why IPv4 is connectionless and unreliable.

## 3. Target user

Primary user:

```text
Undergraduate student taking a computer networking / Internet Protocol course.
```

The target user is not necessarily learning networks from zero. They likely know basic terms from class but need visual feedback to understand packet behavior.

## 4. Product mode

The product is primarily a user-built topology lab.

The user should be able to construct arbitrary small topologies. Prebuilt examples are useful but secondary.

## 5. Top-level user flow

```text
1. User opens the lab.
2. User places Host, Switch, and Router nodes.
3. User connects nodes with Links.
4. The app detects Network Segments.
5. The app auto-assigns IP/MAC/gateway/route configuration.
6. User optionally edits Network Segment or routing configuration.
7. User sends ICMP Echo or Generic IPv4 packet.
8. The app animates packet movement.
9. The app logs every L2/L3 decision.
10. User inspects Packet Detail, Layer View, Routing Table, ARP Cache, MAC Address Table, and Binary Prefix Match.
```

## 6. Main UI layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                              │
│ Lab | Examples | Packet Trace | Settings | Share                     │
├───────────────┬──────────────────────────────────────┬───────────────┤
│ Palette       │                                      │ Inspector     │
│               │                                      │               │
│ Host          │                                      │ Selection     │
│ Switch        │              Canvas                  │ Properties    │
│ Router        │                                      │ Tables        │
│ Link          │                                      │ Segment Info  │
│ Packet Tool   │                                      │ Route Editor  │
│               │                                      │               │
├───────────────┴──────────────────────────────────────┴───────────────┤
│ Simulation Panel                                                     │
│ Controls | Timeline | Event Log | Layer View | Packet Detail         │
│ Binary Match                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

## 7. Required nodes

### Host

A host is an end device. It can create and receive IPv4 datagrams. It does not forward frames or packets.

Host capabilities:

- One interface by default: `eth0`.
- Auto-generated MAC address.
- Auto-assigned IPv4 address and prefix.
- Auto-assigned default gateway when a router exists in the same segment.
- ARP cache.
- Can send ICMP Echo Request.
- Can send Generic IPv4 Packet.
- Can reply to ICMP Echo Request with ICMP Echo Reply.

### Switch

A switch is a Layer 2 forwarding device.

Switch capabilities:

- Multiple ports.
- MAC Address Table.
- Source MAC learning.
- Broadcast flooding.
- Unknown unicast flooding.
- Known unicast forwarding.
- Does not inspect IPv4 destination address.

### Router

A router is a Layer 3 forwarding device.

Router capabilities:

- Multiple interfaces.
- Each interface has MAC address.
- Each connected interface can have IPv4 address and prefix.
- ARP cache per router.
- Routing table.
- Connected route generation.
- Manual static routes.
- Auto-generated static routes.
- Routing table lookup.
- Longest Prefix Match.
- TTL decrement.
- Ethernet decapsulation and re-encapsulation.

## 8. Link requirements

A link connects exactly two interfaces.

Link fields:

- `status`: `up` or `down`.
- `delayMs`: animation/simulation delay.
- `lossRate`: probability from `0` to `1`.

Physical layer implementation details are not modeled.

## 9. Network Segment requirements

A Network Segment is a first-class object.

Definition:

```text
A Network Segment represents one Layer 2 broadcast domain and one IPv4 subnet configuration unit.
```

A segment owns:

- Name.
- CIDR.
- Type: `lan` or `point-to-point`.
- Member interfaces.
- Default gateway, if applicable.
- IP allocation policy.

Switches extend segments. Routers separate segments.

## 10. Auto configuration requirements

The application must support auto configuration by default.

Default settings:

```text
Auto Configuration: On
Auto IP Assignment: On
Auto Static Routes: On
Manual Override: On
```

Auto configuration must include:

- Network Segment detection.
- MAC address assignment.
- IPv4 address assignment.
- Default gateway assignment.
- Connected route generation.
- Auto Static route generation.

Manual overrides must be possible, but auto-generated values should be the default for ease of use.

## 11. Default address policy

LAN segment:

```text
10.0.N.0/24
```

Point-to-point router-to-router segment:

```text
10.255.N.0/30
```

LAN allocation:

```text
Router interfaces: .1, .2, .3, ...
Host interfaces:   .10, .11, .12, ...
```

Reserved addresses:

```text
Network address
Broadcast address
Duplicate IP addresses
```

## 12. Packet types

### ICMP Echo

Used for ping-like behavior.

Required messages:

- `ICMP Echo Request`
- `ICMP Echo Reply`

Optional later messages:

- `ICMP Time Exceeded`
- `ICMP Destination Unreachable`

### Generic IPv4 Packet

A generic IPv4 datagram without TCP/UDP.

Fields:

- Source IP.
- Destination IP.
- TTL.
- Protocol: `RAW`.
- Payload string.

## 13. Packet Generator UI

```text
Packet Generator

Source Host: Host A
Destination Mode: Host | IP Address
Target Host: Host B
Destination IP: 10.0.2.10
Packet Type: ICMP Echo | Generic IPv4 Packet
TTL: 64
Packet Count: 1
Interval: 500 ms
Payload: Hello
```

## 14. Animation requirements

Packets must appear as moving tokens on links.

Token labels:

- `ARP Request`
- `ARP Reply`
- `ICMP Echo Request`
- `ICMP Echo Reply`
- `IPv4 Datagram`
- `Dropped`

ARP Request and unknown unicast flooding must visually split into multiple outgoing frame tokens.

Routers must visually pause packets and show:

```text
Decapsulation → Routing Table Lookup → Re-encapsulation
```

## 15. Inspector requirements

The right-side Inspector must show context-specific information.

Host inspector:

- Interface.
- MAC address.
- IPv4 address.
- Prefix length.
- Default gateway.
- ARP cache.

Switch inspector:

- Ports.
- MAC Address Table.
- Learned MAC entries.

Router inspector:

- Interfaces.
- ARP cache.
- Routing Table.
- Route editor.

Network Segment inspector:

- CIDR.
- Type.
- Member interfaces.
- Default gateway.
- Allocation table.

Packet inspector:

- Current location.
- Ethernet header.
- IPv4 header.
- ICMP or RAW payload.
- Current event.

## 16. Simulation panel requirements

Simulation controls:

```text
Play
Pause
Next Event
Previous Event
Reset
Speed: 0.5x | 1x | 2x | 4x
```

Tabs:

```text
Timeline
Event Log
Layer View
Packet Detail
Binary Match
```

## 17. Event log requirements

Every important decision must produce a log entry.

Examples:

```text
[00.001] Host A checked destination network.
[00.002] Destination 10.0.2.10 is outside 10.0.1.0/24.
[00.003] Host A selected Default Gateway 10.0.1.1.
[00.004] Host A ARP Cache miss for 10.0.1.1.
[00.005] Host A sent ARP Request.
[00.010] Switch S1 learned AA:AA:AA:AA:AA:01 on e0/1.
[00.011] Switch S1 flooded broadcast frame.
[00.020] Router R1 decapsulated IPv4 Datagram.
[00.021] Router R1 decremented TTL from 64 to 63.
[00.022] Router R1 selected route 10.0.2.0/24 by Longest Prefix Match.
```

## 18. Binary Prefix Match requirements

Binary prefix matching must be visible by default during routing lookup.

Example:

```text
Destination IP
10.0.2.10
00001010.00000000.00000010.00001010

Candidate Routes

10.0.2.0/24
00001010.00000000.00000010.xxxxxxxx
Match length: 24
Selected: yes

10.0.0.0/8
00001010.xxxxxxxx.xxxxxxxx.xxxxxxxx
Match length: 8
Selected: no

0.0.0.0/0
xxxxxxxx.xxxxxxxx.xxxxxxxx.xxxxxxxx
Match length: 0
Selected: no
```

## 19. Drop reason requirements

Every dropped packet/frame must have a clear reason.

Required drop reasons:

- `No Default Gateway`
- `No ARP Reply`
- `No Matching Route`
- `TTL Expired`
- `Link Down`
- `Link Loss`
- `Invalid Destination MAC`
- `Interface Down`
- `Invalid IP Configuration`
- `Duplicate IP Address`
- `Duplicate MAC Address`
- `Network Unreachable`
- `Unsupported L2 Loop`

## 20. Persistence requirements

The app is browser-only.

Preferred sharing method:

```text
TopologyState
→ JSON.stringify
→ compress
→ Base64URL / URI-safe encoding
→ URL hash
```

Example:

```text
https://example.com/lab#state=<encoded-state>
```

Also support:

- Export JSON.
- Import JSON.
- Save to Local Storage.
- Load from Local Storage.

## 21. Example topologies

Required examples:

1. `Same LAN Communication`
2. `ARP Cache Hit vs Miss`
3. `Switch MAC Learning`
4. `Default Gateway Forwarding`
5. `Router-to-Router Forwarding`
6. `Longest Prefix Match`
7. `No Matching Route`
8. `TTL Expired Loop`
9. `Link Loss and Unreliable Delivery`
10. `Multiple Datagrams and Connectionless Delivery`

