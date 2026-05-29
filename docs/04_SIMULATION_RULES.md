# 04. Simulation Rules

## General

- IPv4 only.
- Simulation is deterministic except intentional equal-route random selection.
- Every meaningful decision emits a `SimulationEvent`.
- Every failure emits `Packet Drop` with a clear reason.
- ARP and Ethernet forwarding stay inside one `Network Segment`.
- VLAN and STP are out of scope. Unsupported L2 loops block simulation.

## Layer 2

- Switches learn source MAC on ingress.
- Broadcast frames flood to all eligible egress ports except ingress.
- Unknown unicast floods.
- Known unicast forwards only to the learned egress port.
- Hosts and routers do not act as L2 switches.

## ARP

- Hosts ARP for destination IP on same subnet, otherwise for the next hop/gateway value.
- Routers ARP for the selected next hop on the outgoing interface segment.
- ARP Request is broadcast within one segment.
- ARP Reply is unicast to the requester.
- The ARP Request recipient learns the requester IP/MAC before replying.
- ARP Cache entries are dynamic unless explicitly configured otherwise.

## IPv4 Routing

- Hosts choose a source interface that matches destination subnet when possible.
- Routers decapsulate the Ethernet frame, inspect the IPv4 Datagram, decrement TTL, then run route lookup.
- TTL reaching zero drops with `TTL Expired`.
- Route lookup uses Longest Prefix Match. Type precedence resolves equal prefix length conflicts.
- Auto-generated routes are displayed as `Auto Static`, not as a dynamic routing protocol.
- Routers re-encapsulate into a new Ethernet frame after route lookup and ARP resolution.

## ICMP and RAW

- `ICMP Echo Request` to a host can generate `ICMP Echo Reply`.
- Echo Reply generation reuses dynamic tables learned during the request path.
- `Generic IPv4 Packet` carries RAW payload and has no transport protocol behavior.

## Fragmentation

- Link MTU is checked along the selected L2 path.
- Oversized IPv4 datagrams fragment when possible.
- Fragment events expose fragment IDs, offsets, flags, and reassembly.
- Fragmentation does not imply TCP/UDP behavior.

## Drop Reasons

Common drop reasons:

- `No Default Gateway`
- `No Matching Route`
- `Network Unreachable`
- `No ARP Reply`
- `TTL Expired`
- `Interface Down`
- `Link Down`
- `Link Loss`
- `Unsupported L2 Loop`

## Unsupported L2 Loop Text

```text
Unsupported L2 Loop Detected
This topology creates a Layer 2 loop. STP is not supported in this lab.
```
