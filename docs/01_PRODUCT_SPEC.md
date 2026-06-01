# 01. Product Spec

## Purpose

IPv4 Network Visualization Lab is a browser-only lab for inspecting Layer 2 and Layer 3 packet behavior. Users build small topologies, send packets, and inspect the exact forwarding path through animation, logs, packet details, and tables.

## Users

- Computer networking students.
- Instructors or reviewers who need a deterministic visual demo.
- Developers validating IPv4/L2/L3 simulation behavior.

## Scope

Supported:

- IPv4 only.
- `Host`, `Switch`, `Router`, and `Link`.
- Ethernet-like frames, ARP, switch MAC learning, flooding, known unicast forwarding.
- IPv4 forwarding, static routing, Longest Prefix Match, TTL decrement, packet drops.
- ICMP Echo Request/Reply.
- Generic IPv4 packet with RAW payload.
- Network Segment detection, auto IP/MAC assignment, host gateway derivation, connected routes, and `Auto Static` routes.
- Packet animation, `Event Log`, packet detail, dynamic tables, and URL sharing.

Out of scope:

- IPv6, TCP, UDP, DHCP, DNS, NAT, VLAN, STP, wireless, dynamic routing protocols, server persistence, grading features.

## Core Workflows

1. Build a topology on the canvas.
2. Let the app auto-configure addressing and routing.
3. Send `ICMP Echo` or `Generic IPv4 Packet`.
4. Step through events and inspect ARP Cache, MAC Address Table, Routing Table, packet headers, drops, and animation.
5. Share the topology through compressed URL state.

## Required Example Scenarios

- Same LAN ARP and switch learning.
- Default-gateway/one-router forwarding.
- Router-to-router forwarding.
- MTU Fragmentation.
- Redundant router mesh / equal route behavior.
- No Matching Route, TTL Expired, Link Down or Link Loss drops.

## UI Policy

- Core networking labels stay in English, for example `Host`, `Switch`, `Router`, `Network Segment`, `ARP Cache`, `Routing Table`, `Longest Prefix Match`, `TTL`, `Packet Drop`.
- Explanatory copy may be Korean.
- Every non-trivial packet decision must be visible through event log data and relevant UI state.
