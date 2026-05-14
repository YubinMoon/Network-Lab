# 06. Acceptance Tests

This document defines functional acceptance tests for the IPv4 Network Visualization Lab.

## 1. IP utility tests

### Test: IPv4 parse and format

Input:

```text
10.0.1.10
```

Expected:

```text
parseIpv4("10.0.1.10") returns a valid 32-bit value.
formatIpv4(parseIpv4("10.0.1.10")) returns "10.0.1.10".
```

### Test: Network address /24

Input:

```text
IP: 10.0.1.10
Prefix: 24
```

Expected:

```text
networkAddress = 10.0.1.0
broadcastAddress = 10.0.1.255
```

### Test: Network address /30

Input:

```text
IP: 10.255.1.2
Prefix: 30
```

Expected:

```text
networkAddress = 10.255.1.0
broadcastAddress = 10.255.1.3
```

### Test: Prefix match

Input:

```text
IP: 10.0.2.10
Route: 10.0.2.0/24
```

Expected:

```text
match = true
```

Input:

```text
IP: 10.0.2.10
Route: 10.0.1.0/24
```

Expected:

```text
match = false
```

---

## 2. Network Segment detection tests

### Test: Same LAN

Topology:

```text
Host A ─ Switch S1 ─ Host B
```

Expected:

```text
Number of segments: 1
Type: lan
Members include Host A eth0, Host B eth0, and Switch S1 ports.
```

### Test: One router separates two LANs

Topology:

```text
Host A ─ Switch S1 ─ Router R1 ─ Switch S2 ─ Host B
```

Expected:

```text
Number of segments: 2
LAN-1 contains Host A and R1 g0/0.
LAN-2 contains Host B and R1 g0/1.
```

### Test: Direct router-to-router link

Topology:

```text
Router R1 ─ Router R2
```

Expected:

```text
Number of segments: 1
Type: point-to-point
Default CIDR: 10.255.1.0/30
```

---

## 3. Auto configuration tests

### Test: One LAN with one router

Topology:

```text
Host A ─ Switch S1 ─ Router R1
```

Expected:

```text
Segment: 10.0.1.0/24
R1 interface: 10.0.1.1/24
Host A: 10.0.1.10/24
Host A Default Gateway: 10.0.1.1
```

### Test: LAN without router

Topology:

```text
Host A ─ Switch S1 ─ Host B
```

Expected:

```text
Segment: 10.0.1.0/24
Host A: 10.0.1.10/24
Host B: 10.0.1.11/24
Default Gateway: none for both hosts
Same-LAN communication works.
External-network communication drops with No Default Gateway.
```

### Test: Segment CIDR edit propagates

Initial:

```text
LAN-1: 10.0.1.0/24
R1 g0/0: 10.0.1.1/24
Host A eth0: 10.0.1.10/24
Host A Gateway: 10.0.1.1
```

User edits segment:

```text
LAN-1: 192.168.10.0/24
```

Expected:

```text
R1 g0/0: 192.168.10.1/24
Host A eth0: 192.168.10.10/24
Host A Gateway: 192.168.10.1
Connected routes updated.
Auto static routes updated.
```

---

## 4. Connected route tests

### Test: Router with two LANs

Topology:

```text
Host A ─ Switch S1 ─ R1 ─ Switch S2 ─ Host B
```

Expected R1 routing table:

```text
10.0.1.0/24 → connected → g0/0 → Connected
10.0.2.0/24 → connected → g0/1 → Connected
```

---

## 5. Auto Static route tests

### Test: Two routers, two LANs

Topology:

```text
Host A ─ LAN-1 ─ R1 ─ P2P-1 ─ R2 ─ LAN-2 ─ Host B
```

Expected addressing:

```text
LAN-1: 10.0.1.0/24
R1 LAN interface: 10.0.1.1
Host A: 10.0.1.10

P2P-1: 10.255.1.0/30
R1 P2P interface: 10.255.1.1
R2 P2P interface: 10.255.1.2

LAN-2: 10.0.2.0/24
R2 LAN interface: 10.0.2.1
Host B: 10.0.2.10
```

Expected R1 route:

```text
10.0.2.0/24 → 10.255.1.2 → R1 P2P interface → Auto Static
```

Expected R2 route:

```text
10.0.1.0/24 → 10.255.1.1 → R2 P2P interface → Auto Static
```

---

## 6. Longest Prefix Match tests

### Test: More specific route wins

Router table:

```text
10.0.0.0/8     → next hop A
10.0.2.0/24    → next hop B
0.0.0.0/0      → default
```

Destination:

```text
10.0.2.10
```

Expected:

```text
Selected route: 10.0.2.0/24
Reason: Longest Prefix Match
```

Binary panel must show:

```text
10.0.2.0/24 match length 24 selected
10.0.0.0/8 match length 8 not selected
0.0.0.0/0 match length 0 not selected
```

### Test: Default route used

Router table:

```text
10.0.1.0/24 connected
0.0.0.0/0 next hop 10.255.1.2
```

Destination:

```text
203.0.113.10
```

Expected:

```text
Selected route: 0.0.0.0/0
Reason: Longest Prefix Match
```

---

## 7. ARP tests

### Test: Same LAN ARP

Topology:

```text
Host A ─ Switch S1 ─ Host B
```

Host A sends to Host B.

Expected:

```text
Host A ARP target IP = Host B IP.
ARP Request destination MAC = FF:FF:FF:FF:FF:FF.
Switch floods ARP Request.
Host B sends ARP Reply.
Host A updates ARP Cache with Host B IP → Host B MAC.
```

### Test: Gateway ARP

Topology:

```text
Host A ─ LAN-1 ─ R1 ─ LAN-2 ─ Host B
```

Host A sends to Host B.

Expected:

```text
Host A ARP target IP = R1 LAN-1 interface IP.
Host A does not ARP for Host B IP.
```

---

## 8. Switch behavior tests

### Test: MAC learning

When Switch S1 receives frame from Host A on e0/1:

Expected:

```text
MAC Address Table contains Host A MAC → e0/1.
Event log records source MAC learning.
```

### Test: Broadcast flooding

ARP Request received on e0/1.

Expected:

```text
Frame forwarded to all ports except e0/1.
Event type: switch-broadcast-flooded.
```

### Test: Known unicast forwarding

MAC table contains:

```text
Host B MAC → e0/2
```

Frame destination MAC is Host B MAC.

Expected:

```text
Frame forwarded only to e0/2.
```

### Test: Unknown unicast flooding

Destination MAC is not in table.

Expected:

```text
Frame flooded to all ports except ingress.
Event label: Unknown Unicast Flooding.
```

---

## 9. Router forwarding tests

### Test: Router rewrites Ethernet header

Before router:

```text
Ethernet Source MAC: Host A MAC
Ethernet Destination MAC: R1 g0/0 MAC
IPv4 Source IP: Host A IP
IPv4 Destination IP: Host B IP
TTL: 64
```

After router:

```text
Ethernet Source MAC: R1 g0/1 MAC
Ethernet Destination MAC: next hop MAC
IPv4 Source IP: Host A IP
IPv4 Destination IP: Host B IP
TTL: 63
```

Expected:

```text
Source IP unchanged.
Destination IP unchanged.
TTL decremented.
Source MAC changed.
Destination MAC changed.
```

### Test: No matching route

Router receives datagram to `10.0.99.10`, but table has no matching route.

Expected:

```text
Packet dropped.
Reason: No Matching Route.
Event log includes route lookup candidates.
```

### Test: TTL expired

Initial TTL:

```text
1
```

Router receives packet and decrements TTL.

Expected:

```text
TTL 1 → 0
Packet dropped.
Reason: TTL Expired.
```

---

## 10. ICMP Echo tests

### Test: Successful ping across one router

Topology:

```text
Host A ─ LAN-1 ─ R1 ─ LAN-2 ─ Host B
```

Action:

```text
Host A sends ICMP Echo to Host B.
```

Expected:

```text
ICMP Echo Request delivered to Host B.
Host B creates ICMP Echo Reply.
ICMP Echo Reply delivered to Host A.
Ping result: success.
```

### Test: Echo request delivered but reply fails

Make return route unavailable.

Expected:

```text
Echo Request delivered.
Echo Reply dropped.
Ping result indicates request reached destination but reply failed.
```

---

## 11. Generic IPv4 packet tests

### Test: Generic packet delivered

Action:

```text
Host A sends Generic IPv4 Packet with payload "Hello" to Host B.
```

Expected:

```text
Host B receives RAW payload "Hello".
No reply generated.
```

---

## 12. Link tests

### Test: Link down

Set link status to down.

Expected:

```text
Frame attempting to traverse link is dropped.
Reason: Link Down.
```

### Test: Link loss

Set loss rate to 1.0.

Expected:

```text
All frames crossing the link are dropped.
Reason: Link Loss.
```

Set loss rate to 0.0.

Expected:

```text
No link-loss drops occur.
```

---

## 13. Connectionless/unreliable tests

### Test: Multiple independent packets

Action:

```text
Packet Count: 5
Packet Type: Generic IPv4 Packet
```

Expected:

```text
Five distinct IPv4 datagrams are created.
Each has its own packet ID.
Each performs independent routing decisions.
```

### Test: Loss demonstrates unreliability

Set one link loss rate to `0.5` or deterministic test loss pattern.

Expected:

```text
Some packets delivered.
Some packets dropped.
No automatic retransmission occurs.
```

---

## 14. Unsupported L2 loop tests

Topology:

```text
S1 ─ S2
│    │
└────┘
```

Expected:

```text
Unsupported L2 Loop Detected.
Simulation blocked if blockUnsupportedL2Loops = true.
Reason: Unsupported L2 Loop.
```

---

## 15. URL persistence tests

### Test: Share URL round trip

Action:

1. Create topology.
2. Click `Share`.
3. Copy generated URL.
4. Open URL in another tab.

Expected:

```text
Same nodes, links, segment config, and route config are restored.
Runtime animation state is not required to restore.
```

### Test: Export/import JSON

Action:

1. Export topology JSON.
2. Clear lab.
3. Import JSON.

Expected:

```text
Same topology is restored.
Validation passes.
```

