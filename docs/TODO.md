# TODO

This file tracks planned work and completed work for the IPv4 Network Visualization Lab.

## Working Rules

- Review this file before starting a task.
- Keep task scope small enough to verify independently.
- Move completed items to `Completed Work` with the date and commit hash when available.
- Commit after each completed work unit.

## Completed Work

- 2026-05-14: Created project TODO tracking and documented TODO/git workflow in `AGENTS.md`.
- 2026-05-14: Completed Phase 0 project bootstrap with Vite, React, TypeScript strict mode, Vitest, baseline folders, and passing test/build checks.
- 2026-05-14: Completed Phase 1 domain data model plus IPv4, MAC, and validation utilities with unit tests.
- 2026-05-14: Completed Phase 2 topology store and React Flow editor with Host, Switch, Router, Link, selection, deletion, and Inspector support.
- 2026-05-14: Completed Phase 3 Network Segment detection with interface graph components, LAN/point-to-point classification, segment identity preservation, and Inspector visibility.
- 2026-05-14: Completed Phase 4 auto MAC/IP/default gateway assignment and displayed IPv4 interface configuration in the canvas and Inspector.
- 2026-05-14: Completed Phase 5 connected route generation, auto static route generation, route precedence, and Longest Prefix Match lookup tests.
- 2026-05-14: Completed Phase 6 Layer 2 switch MAC learning, broadcast flooding, unknown unicast flooding, known unicast forwarding, and MAC Address Table display.
- 2026-05-14: Completed Phase 7 ARP target selection, ARP request/reply frame helpers, ARP cache updates, and ARP Cache Inspector tables.
- 2026-05-14: Completed Phase 8 deterministic IPv4 forwarding trace with host send decisions, router TTL decrement, route lookup, re-encapsulation, and packet drop reasons.
- 2026-05-14: Completed Phase 9 ICMP Echo Request/Reply, Generic IPv4 Packet payloads, Packet Generator UI, and Event Log integration.
- 2026-05-14: Completed Phase 10 simulation controls, Timeline, Event Log, Layer View, Packet Detail, Binary Match, and current packet token UI.
- 2026-05-14: Completed Phase 11 JSON export/import, Local Storage save/load, compressed URL hash sharing, and persistence controls.
- 2026-05-14: Completed Phase 12 required example topologies and Example loader UI with initial packet traces.
- 2026-05-14: Completed Phase 13 validation warnings, unsupported L2 loop simulation block, reset controls, event log clearing, and route table highlighting.

## In Progress

- Completion audit.

## Planned Work

### Phase 0. Project Bootstrap

- [x] Create a Vite + React + TypeScript app at the repository root.
- [x] Install runtime dependencies: `@xyflow/react`, `zustand`, `lz-string`, `nanoid`, `clsx`.
- [x] Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- [x] Ensure TypeScript strict mode is enabled.
- [x] Create the basic source folder structure.
- [x] Configure the test runner.
- [x] Verify `npm run test` passes.
- [x] Verify `npm run build` passes.

### Phase 1. Domain Utilities and Data Model

- [x] Define core topology, interface, route, packet, and simulation event types.
- [x] Implement IPv4 utilities.
- [x] Implement MAC address utilities.
- [x] Add validation helpers.
- [x] Add unit tests for IPv4 and MAC utilities.

### Phase 2. Topology Store and Basic Editor

- [x] Add global lab state store.
- [x] Add canvas editor with `Host`, `Switch`, `Router`, and `Link`.
- [x] Add basic inspector for selected objects.
- [x] Verify the first target topology can be created visually.

### Phase 3. Network Segment Detection

- [x] Implement interface graph helpers.
- [x] Implement `Network Segment` detection.
- [x] Preserve segment identity when possible after edits.
- [x] Add segment detection tests.

### Phase 4. Auto IP/MAC/Gateway Assignment

- [x] Implement deterministic MAC assignment.
- [x] Implement LAN and point-to-point CIDR assignment.
- [x] Implement host and router interface IP assignment.
- [x] Implement default gateway assignment.
- [x] Add auto configuration tests.

### Phase 5. Connected and Auto Static Routes

- [x] Generate `Connected` routes.
- [x] Generate `Auto Static` routes.
- [x] Implement route precedence for equal prefix length.
- [x] Add routing table tests.

### Phase 6. Layer 2 Switching

- [x] Implement switch MAC learning.
- [x] Implement broadcast flooding.
- [x] Implement unknown unicast flooding.
- [x] Implement known unicast forwarding.
- [x] Add Layer 2 tests.

### Phase 7. ARP Simulation

- [x] Implement ARP cache lookup.
- [x] Implement ARP request/reply behavior.
- [x] Ensure ARP stays within one `Network Segment`.
- [x] Add ARP tests.

### Phase 8. IPv4 Forwarding Simulation

- [x] Implement host send path.
- [x] Implement router decapsulation, TTL decrement, route lookup, ARP, and re-encapsulation.
- [x] Implement required packet drop reasons.
- [x] Add simulation tests.

### Phase 9. ICMP Echo and Generic IPv4 Packets

- [x] Implement `ICMP Echo Request`.
- [x] Implement `ICMP Echo Reply`.
- [x] Implement `Generic IPv4 Packet` with RAW payload.
- [x] Add packet generator UI.

### Phase 10. Animation and Simulation Panels

- [x] Add animated packet tokens.
- [x] Add simulation controls.
- [x] Add `Event Log`, `Layer View`, `Packet Detail`, `Binary Match`, and `Timeline` panels.
- [x] Highlight relevant tables during simulation.

### Phase 11. URL State and Export/Import

- [x] Export topology JSON.
- [x] Import topology JSON.
- [x] Save and load topology from Local Storage.
- [x] Encode and decode share URLs with compressed state.

### Phase 12. Examples

- [x] Add required example topologies.
- [x] Ensure each example can be simulated immediately.

### Phase 13. Polish and Validation

- [x] Add validation warnings.
- [x] Add unsupported L2 loop detection.
- [x] Improve inspector tables and selected field highlights.
- [x] Add reset controls for dynamic tables and event logs.
