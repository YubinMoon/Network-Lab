# TODO

This file tracks planned work and completed work for the IPv4 Network Visualization Lab.

## Working Rules

- Review this file before starting a task.
- Keep task scope small enough to verify independently.
- Move completed items to `Completed Work` with the date and commit hash when available.
- Commit after each completed work unit.

## Completed Work

- 2026-05-25: Completed active Link packet detail cleanup by removing the non-protocol Transit block and unused top navigation buttons, with regression tests and browser verification.
- 2026-05-25: Completed active Link packet inspection so selecting a moving Link shows Ethernet, ARP, IPv4, ICMP, and payload details in the Inspector, with regression tests and browser verification.
- 2026-05-25: Completed Host source-interface selection so multi-interface Hosts send through the interface that matches the destination subnet, with regression tests and browser verification.
- 2026-05-25: Completed loaded example link/interface normalization so adding Host C to Host B creates Host B eth1 and keeps Host C outside the switch broadcast domain, with regression tests and browser verification.
- 2026-05-25: Completed selected-node highlight and Host multi-interface link handling so additional Host links create separate interfaces and L2 segments, with regression tests and browser verification.
- 2026-05-25: Completed switch known-unicast event fix so simulation uses Layer 2 MAC-table decisions and animates only the selected egress link, with regression tests and browser verification.
- 2026-05-25: Completed follow-up canvas camera fix so explicit fit requests do not replay when nodes are added after a topology load, with regression tests and browser verification.
- 2026-05-25: Completed canvas camera preservation on node creation by removing unconditional React Flow fit behavior while keeping explicit fit requests for topology loads, with regression tests and browser verification.
- 2026-05-24: Completed current-event topology editing so loading an example and editing before playback no longer leaks precomputed ARP Cache or MAC Address Table entries, with regression tests and browser verification.
- 2026-05-24: Completed event-indexed Inspector dynamic tables so ARP Cache and MAC Address Table reflect the selected simulation event, with regression tests and browser verification.
- 2026-05-24: Completed example MAC assignment fix and stopped presenting Layer 2 switch ports as endpoint MAC owners, with validation/UI regression tests and browser verification.
- 2026-05-24: Completed playback control order update so `Reset` sits to the right of the `Play`/`Pause` toggle, with regression tests and browser verification.
- 2026-05-24: Completed playback controls cleanup by merging `Play` and `Pause` into one green/red toggle button in the left panel, with regression tests and browser verification.
- 2026-05-24: Completed link status label cleanup so normal `Link - up` labels stay hidden unless selected while down links remain visible, with regression tests and browser verification.
- 2026-05-22: Completed `Load Example` layout fix so example nodes are spaced apart and the canvas refits on example load, with regression tests and browser verification.
- 2026-05-22: Completed ARP sent event animation fix so ARP Request/Reply sent events show only the first physical hop, with switched-topology regression tests and browser verification.
- 2026-05-22: Completed directional `Link` packet animation so reverse traffic renders from target to source, with focused tests and browser verification.
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
- 2026-05-14: Completed completion-audit follow-up for ARP reply/cache events, switch MAC learning events in packet traces, deterministic `Link Loss` drops, `Packet Count` batch simulation, and dynamic table updates.
- 2026-05-14: Completed completion-audit follow-up for animated packet movement on active `Link` edges during packet events.
- 2026-05-14: Completed completion-audit follow-up for ARP Cache hit simulation after dynamic cache entries are populated.
- 2026-05-14: Completed completion-audit follow-up for exact unsupported Layer 2 loop warning text.
- 2026-05-14: Completed final completion audit with clean TODO, passing test/build/lint checks, and verified local app response.
- 2026-05-14: Completed fixed-height lab layout, internal Inspector/Palette scrolling, collapsible Simulation Panel, and visible current-packet canvas state.
- 2026-05-14: Completed layout adjustment moving playback controls into the left sidebar, expanding the Event Log row, and making the Inspector span the full right column.
- 2026-05-15: Completed follow-up keeping playback controls visible in the Palette after sending packets and widening the Event Log list indentation.
- 2026-05-15: Completed dark application theme, icon-only Event Log panel toggle, fullscreen browser acceptance verification, and Export/Clear/Import JSON UI fix.

## In Progress

- None.

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
