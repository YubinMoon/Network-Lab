# Codex Bootstrap Prompt

Use this prompt when starting the implementation in Codex.

```text
You are implementing a browser-only React + TypeScript application named `IPv4 Network Visualization Lab`.

Read and follow `AGENTS.md` and all files in `docs/`.

Goal:
Build an educational IPv4 Layer 2 / Layer 3 network simulator where users place Host, Switch, Router, and Link objects on a canvas, auto-configure network segments, send ICMP Echo or Generic IPv4 packets, and visually inspect Ethernet, ARP, switch forwarding, routing table lookup, Longest Prefix Match, TTL handling, and packet drops.

Hard constraints:
- IPv4 only.
- UI technical labels must be English.
- No IPv6, TCP, UDP, DHCP, DNS, NAT, VLAN, STP, or dynamic routing protocols.
- Static routing only; auto-generated routes must be labeled `Auto Static`.
- Browser-only; no backend.
- Implement URL-encoded topology sharing if practical.

Recommended stack:
- Vite + React + TypeScript
- @xyflow/react for canvas/node editor
- Zustand for state
- lz-string for URL-safe compressed state
- Vitest for domain tests

Implementation order:
1. Create project scaffold.
2. Add TypeScript domain models in `src/domain/types.ts`.
3. Add pure IPv4/MAC utilities.
4. Add topology state store.
5. Add basic canvas with Host/Switch/Router nodes and Links.
6. Add Network Segment detection.
7. Add Auto IP/MAC/Gateway assignment.
8. Add Connected Route and Auto Static Route generation.
9. Add L2 switching and ARP simulation.
10. Add IPv4 routing simulation.
11. Add ICMP Echo and Generic IPv4 packet sending.
12. Add animation, event log, layer view, packet detail, binary prefix match.
13. Add URL export/import and tests.

Start by implementing the first working milestone:
`Host A ─ Switch S1 ─ Router R1 ─ Switch S2 ─ Host B`
with ICMP Echo Request/Reply working end-to-end.

Keep networking logic in pure functions under `src/domain/`. Do not hide ARP, routing lookup, TTL decrement, MAC learning, or route selection. Every important decision must produce a simulation event and an Event Log entry.
```

