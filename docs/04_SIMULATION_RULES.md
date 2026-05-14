# 04. Simulation Rules

This document specifies exact Layer 2 and Layer 3 behavior for the simulator.

## 1. General principles

- The simulator models Ethernet-like Layer 2 behavior and IPv4 Layer 3 behavior.
- Physical layer implementation details are ignored.
- TCP and UDP are ignored.
- ICMP Echo is supported because ping is useful for Layer 3 learning.
- ARP is explicitly simulated.
- Every significant decision must create a `SimulationEvent`.
- Every packet/frame drop must have a clear `PacketDropReason`.

## 2. Layer boundaries

### 2.1 Switch

A switch uses Layer 2 information only.

It may inspect:

```text
Ethernet Source MAC
Ethernet Destination MAC
EtherType
```

It must not use:

```text
IPv4 Source IP
IPv4 Destination IP
TTL
Routing Table
```

### 2.2 Router

A router receives an Ethernet frame, verifies the Layer 2 destination, removes the Ethernet header, processes the IPv4 datagram, and creates a new Ethernet frame for the next hop.

Router behavior must show:

```text
Ethernet Frame received
→ Destination MAC check
→ Decapsulation
→ IPv4 Datagram inspection
→ TTL decrement
→ Routing Table Lookup
→ Next Hop selection
→ ARP resolution
→ Re-encapsulation
→ Forwarding
```

## 3. Host packet sending

When a host sends an IPv4 datagram:

1. Validate host interface state.
2. Validate source IP and prefix.
3. Determine whether the destination IP is in the same subnet.
4. If same subnet, ARP target IP is destination IP.
5. If outside subnet, ARP target IP is default gateway IP.
6. If outside subnet and no default gateway exists, drop with `No Default Gateway`.
7. Resolve ARP target IP to MAC.
8. Encapsulate IPv4 datagram in Ethernet frame.
9. Send frame through host interface.

Example same-subnet decision:

```text
Source IP: 10.0.1.10/24
Destination IP: 10.0.1.11
Decision: same subnet
ARP Target IP: 10.0.1.11
```

Example external-subnet decision:

```text
Source IP: 10.0.1.10/24
Destination IP: 10.0.2.10
Decision: outside subnet
Default Gateway: 10.0.1.1
ARP Target IP: 10.0.1.1
```

Important: when sending to an external network, the host does not ARP for the final destination IP. It ARPs for the default gateway IP.

## 4. ARP behavior

### 4.1 ARP cache lookup

Before sending an Ethernet frame that carries IPv4, the sending host/router checks its ARP cache.

If entry exists:

```text
ARP Cache Hit
```

If no entry exists:

```text
ARP Cache Miss
Send ARP Request
```

### 4.2 ARP Request frame

Ethernet frame:

```text
Destination MAC: FF:FF:FF:FF:FF:FF
Source MAC: sender interface MAC
EtherType: ARP
```

ARP payload:

```text
Operation: request
Sender IP: sender IP
Sender MAC: sender MAC
Target IP: target IP
Target MAC: unknown
```

The ARP Request is broadcast within the same Network Segment only.

### 4.3 ARP Reply frame

The device whose interface IP equals `Target IP` sends ARP Reply.

Ethernet frame:

```text
Destination MAC: request sender MAC
Source MAC: target interface MAC
EtherType: ARP
```

ARP payload:

```text
Operation: reply
Sender IP: target interface IP
Sender MAC: target interface MAC
Target IP: original sender IP
Target MAC: original sender MAC
```

### 4.4 ARP cache update

The receiver of ARP Reply updates ARP cache:

```text
Sender IP → Sender MAC
```

Optionally, a device receiving an ARP Request may also learn the sender mapping.

Recommended MVP behavior:

- Update receiver cache on ARP Reply.
- Also update cache from ARP Request sender fields if this is easy to implement.

## 5. Switch behavior

When a switch receives an Ethernet frame on an ingress port:

1. Learn source MAC address.
2. If destination MAC is broadcast, flood all ports except ingress port.
3. Else if destination MAC is known in MAC Address Table, forward to the mapped port.
4. Else flood all ports except ingress port as unknown unicast.

### 5.1 Source MAC learning

```text
MAC Address Table[source MAC] = ingress port
```

If an entry already exists with another port, update it.

### 5.2 Broadcast flooding

Broadcast destination:

```text
FF:FF:FF:FF:FF:FF
```

Action:

```text
Send copy to all switch ports except ingress port.
```

### 5.3 Unknown unicast flooding

If destination MAC is not in MAC Address Table:

```text
Send copy to all switch ports except ingress port.
```

Label this explicitly as:

```text
Unknown Unicast Flooding
```

### 5.4 Known unicast forwarding

If destination MAC maps to a port:

```text
Forward only to that port.
```

### 5.5 Switch does not inspect IP

Event log must emphasize that switch selection is based on destination MAC, not destination IP.

Example:

```text
Switch S1 forwarded frame using Destination MAC AA:AA:AA:AA:FF:01. IPv4 Destination IP was not inspected.
```

## 6. Router forwarding behavior

When a router receives an Ethernet frame:

1. Identify ingress interface.
2. If interface is down, drop with `Interface Down`.
3. Check destination MAC:
   - If destination MAC equals ingress interface MAC, accept.
   - If destination MAC is broadcast and EtherType is ARP, process ARP.
   - Otherwise drop or ignore with `Invalid Destination MAC`.
4. If EtherType is ARP, process ARP.
5. If EtherType is IPv4, decapsulate and inspect IPv4 datagram.
6. If destination IP belongs to the router itself, process locally.
7. Otherwise decrement TTL.
8. If TTL becomes 0, drop with `TTL Expired`.
9. Perform routing table lookup.
10. If no matching route, drop with `No Matching Route`.
11. Determine next hop IP.
12. Resolve next hop MAC using ARP.
13. Create new Ethernet frame.
14. Forward out selected interface.

## 7. TTL behavior

TTL is decremented by each router that forwards the datagram.

Host sending does not decrement TTL.

Switch forwarding does not decrement TTL.

If TTL becomes `0` after decrement at a router, the packet is dropped.

Example:

```text
Initial TTL: 4
R1: 4 → 3
R2: 3 → 2
R1: 2 → 1
R2: 1 → 0
Drop: TTL Expired
```

## 8. Routing table lookup

Routing table lookup uses Longest Prefix Match.

Algorithm:

```ts
function lookupRoute(dstIp: string, routes: RouteEntry[]): RouteLookupResult {
  const candidates = routes
    .filter(route => route.enabled)
    .map(route => ({
      route,
      matched: ipMatchesPrefix(dstIp, route.destinationNetwork, route.prefixLength),
      matchLength: ipMatchesPrefix(dstIp, route.destinationNetwork, route.prefixLength)
        ? route.prefixLength
        : 0,
      binaryPattern: toBinaryPrefixPattern(route.destinationNetwork, route.prefixLength),
    }));

  const matched = candidates.filter(c => c.matched);
  if (matched.length === 0) {
    return { candidates, reason: "no-match" };
  }

  const selected = matched.sort(compareRoutes)[0];
  return {
    selectedRoute: selected.route,
    candidates,
    reason: "longest-prefix-match",
  };
}
```

Route comparison:

```text
1. Higher prefix length wins.
2. If equal prefix length, route type precedence wins:
   Connected > Manual Static > Auto Static > Default
3. If equal, lower metric wins.
4. If equal, stable insertion order wins.
```

## 9. Next hop selection

For a selected route:

### 9.1 Connected route

If the selected route is connected:

```text
Next Hop IP = IPv4 Destination IP
Out Interface = route.outInterfaceId
```

The router ARPs for the final destination IP on that directly connected segment.

### 9.2 Static route with next hop

If the selected route has `nextHopIp`:

```text
Next Hop IP = route.nextHopIp
Out Interface = route.outInterfaceId
```

The router ARPs for the next hop IP, not the final destination IP.

### 9.3 Default route

A default route is simply a route with:

```text
Destination: 0.0.0.0
Prefix: /0
```

It matches every destination but has the shortest possible prefix length.

## 10. Router re-encapsulation

Router must create a new Ethernet frame after route lookup and ARP resolution.

Before router:

```text
Ethernet Source MAC: previous hop MAC
Ethernet Destination MAC: router ingress interface MAC
IPv4 Source IP: original source IP
IPv4 Destination IP: final destination IP
TTL: N
```

After router:

```text
Ethernet Source MAC: router egress interface MAC
Ethernet Destination MAC: next hop MAC
IPv4 Source IP: original source IP
IPv4 Destination IP: final destination IP
TTL: N - 1
```

Important:

```text
Source IP remains unchanged.
Destination IP remains unchanged.
TTL changes.
Source MAC changes.
Destination MAC changes.
```

## 11. Destination host behavior

When a host receives an Ethernet frame:

1. If destination MAC does not equal host interface MAC and is not broadcast for ARP, ignore/drop.
2. If EtherType is ARP, process ARP.
3. If EtherType is IPv4:
   - Decapsulate frame.
   - Check destination IP.
   - If destination IP matches host IP, deliver datagram.
   - If not, drop/ignore because host does not forward.

If delivered datagram is ICMP Echo Request:

```text
Generate ICMP Echo Reply
Source IP = receiving host IP
Destination IP = original source IP
TTL = default TTL
ICMP identifier and sequence number copied
```

Then send using the normal host packet sending process.

## 12. Generic IPv4 packet behavior

For `Generic IPv4 Packet`:

- Use protocol `RAW`.
- No ICMP reply is generated.
- Destination host displays delivered payload.

## 13. Ping behavior

Ping consists of:

1. ICMP Echo Request from source host to destination IP.
2. ICMP Echo Reply from destination host back to source IP.

Result states:

```text
Echo Request Delivered + Echo Reply Delivered = Ping success
Echo Request Dropped = Ping failure
Echo Reply Dropped = Ping request reached target, reply failed
```

## 14. Link behavior

When sending a frame across a link:

1. If link status is `down`, drop with `Link Down`.
2. If either interface is `down`, drop with `Interface Down`.
3. Apply link loss probability.
4. If lost, drop with `Link Loss`.
5. Apply `delayMs` to animation/event timing.
6. Deliver to peer interface.

## 15. Connectionless IPv4 demonstration

Multiple packets should be treated independently.

If user sends `Packet Count = 5`, create five distinct IPv4 datagrams.

Each datagram:

- Has its own packet ID.
- Performs its own routing decisions.
- Can be delivered, dropped, delayed, or routed differently if topology changes between transmissions.

Display message:

```text
Each IPv4 datagram is forwarded independently. No connection state is created before transmission.
```

## 16. Unreliable IPv4 demonstration

IPv4 does not guarantee delivery, ordering, or retransmission.

When link loss drops a packet, do not automatically retransmit it.

Display message:

```text
IPv4 does not retransmit dropped packets. Reliability must be provided by upper layers if needed.
```

## 17. Unsupported L2 loop behavior

Because STP is out of scope, unsupported L2 loops should block simulation.

If detected:

```text
Packet simulation blocked.
Reason: Unsupported L2 Loop
```

Display warning:

```text
Unsupported L2 Loop Detected
This topology creates a Layer 2 loop. STP is not supported in this lab.
Broadcast and unknown unicast frames may loop indefinitely.
```

## 18. Required event examples

### 18.1 Host external destination

```text
Host A created ICMP Echo Request.
Host A checked destination network.
Destination 10.0.2.10 is outside 10.0.1.0/24.
Host A selected Default Gateway 10.0.1.1.
Host A ARP Cache miss for 10.0.1.1.
Host A sent ARP Request.
```

### 18.2 Switch ARP flooding

```text
Switch S1 received Ethernet Frame on e0/1.
Switch S1 learned AA:AA:AA:AA:AA:01 on e0/1.
Switch S1 flooded broadcast frame to e0/2, e0/3.
```

### 18.3 Router forwarding

```text
Router R1 received Ethernet Frame on g0/0.
Destination MAC matched R1 g0/0.
Router R1 decapsulated IPv4 Datagram.
Router R1 decremented TTL from 64 to 63.
Router R1 started Routing Table Lookup for 10.0.2.10.
Router R1 selected 10.0.2.0/24 by Longest Prefix Match.
Router R1 selected Next Hop 10.0.2.10 through g0/1.
Router R1 ARP Cache miss for 10.0.2.10.
Router R1 sent ARP Request.
Router R1 created new Ethernet Frame.
Router R1 forwarded frame out g0/1.
```

## 19. Layer View examples

### 19.1 ARP Request

```text
Ethernet Frame
├─ Destination MAC: FF:FF:FF:FF:FF:FF
├─ Source MAC: AA:AA:AA:AA:AA:01
├─ EtherType: ARP
└─ ARP Message
   ├─ Operation: Request
   ├─ Sender IP: 10.0.1.10
   ├─ Sender MAC: AA:AA:AA:AA:AA:01
   ├─ Target IP: 10.0.1.1
   └─ Target MAC: unknown
```

### 19.2 IPv4 over Ethernet

```text
Ethernet Frame
├─ Destination MAC: AA:AA:AA:AA:FF:01
├─ Source MAC: AA:AA:AA:AA:AA:01
├─ EtherType: IPv4
└─ IPv4 Datagram
   ├─ Source IP: 10.0.1.10
   ├─ Destination IP: 10.0.2.10
   ├─ TTL: 64
   ├─ Protocol: ICMP
   └─ Payload: ICMP Echo Request
```

## 20. Binary Prefix Match example

```text
Destination IP
10.0.2.10
00001010.00000000.00000010.00001010

Route 10.0.2.0/24
00001010.00000000.00000010.xxxxxxxx
Result: match, length 24

Route 10.0.0.0/8
00001010.xxxxxxxx.xxxxxxxx.xxxxxxxx
Result: match, length 8

Route 0.0.0.0/0
xxxxxxxx.xxxxxxxx.xxxxxxxx.xxxxxxxx
Result: match, length 0

Selected Route
10.0.2.0/24
Reason: Longest Prefix Match
```

