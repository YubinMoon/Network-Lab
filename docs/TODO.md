# TODO

This file tracks planned work and completed work for the IPv4 Network Visualization Lab.

## Working Rules

- Review this file before starting a task.
- Keep task scope small enough to verify independently.
- Move completed items to `Completed Work` with the date and commit hash when available.
- Commit after each completed work unit.

## Completed Work

- 2026-05-14: Created project TODO tracking and documented TODO/git workflow in `AGENTS.md`.

## In Progress

- Phase 0: Project bootstrap.

## Planned Work

### Phase 0. Project Bootstrap

- [ ] Create a Vite + React + TypeScript app at the repository root.
- [ ] Install runtime dependencies: `@xyflow/react`, `zustand`, `lz-string`, `nanoid`, `clsx`.
- [ ] Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- [ ] Ensure TypeScript strict mode is enabled.
- [ ] Create the basic source folder structure.
- [ ] Configure the test runner.
- [ ] Verify `npm run test` passes.
- [ ] Verify `npm run build` passes.

### Phase 1. Domain Utilities and Data Model

- [ ] Define core topology, interface, route, packet, and simulation event types.
- [ ] Implement IPv4 utilities.
- [ ] Implement MAC address utilities.
- [ ] Add validation helpers.
- [ ] Add unit tests for IPv4 and MAC utilities.

### Phase 2. Topology Store and Basic Editor

- [ ] Add global lab state store.
- [ ] Add canvas editor with `Host`, `Switch`, `Router`, and `Link`.
- [ ] Add basic inspector for selected objects.
- [ ] Verify the first target topology can be created visually.

### Phase 3. Network Segment Detection

- [ ] Implement interface graph helpers.
- [ ] Implement `Network Segment` detection.
- [ ] Preserve segment identity when possible after edits.
- [ ] Add segment detection tests.

### Phase 4. Auto IP/MAC/Gateway Assignment

- [ ] Implement deterministic MAC assignment.
- [ ] Implement LAN and point-to-point CIDR assignment.
- [ ] Implement host and router interface IP assignment.
- [ ] Implement default gateway assignment.
- [ ] Add auto configuration tests.

### Phase 5. Connected and Auto Static Routes

- [ ] Generate `Connected` routes.
- [ ] Generate `Auto Static` routes.
- [ ] Implement route precedence for equal prefix length.
- [ ] Add routing table tests.

### Phase 6. Layer 2 Switching

- [ ] Implement switch MAC learning.
- [ ] Implement broadcast flooding.
- [ ] Implement unknown unicast flooding.
- [ ] Implement known unicast forwarding.
- [ ] Add Layer 2 tests.

### Phase 7. ARP Simulation

- [ ] Implement ARP cache lookup.
- [ ] Implement ARP request/reply behavior.
- [ ] Ensure ARP stays within one `Network Segment`.
- [ ] Add ARP tests.

### Phase 8. IPv4 Forwarding Simulation

- [ ] Implement host send path.
- [ ] Implement router decapsulation, TTL decrement, route lookup, ARP, and re-encapsulation.
- [ ] Implement required packet drop reasons.
- [ ] Add simulation tests.

### Phase 9. ICMP Echo and Generic IPv4 Packets

- [ ] Implement `ICMP Echo Request`.
- [ ] Implement `ICMP Echo Reply`.
- [ ] Implement `Generic IPv4 Packet` with RAW payload.
- [ ] Add packet generator UI.

### Phase 10. Animation and Simulation Panels

- [ ] Add animated packet tokens.
- [ ] Add simulation controls.
- [ ] Add `Event Log`, `Layer View`, `Packet Detail`, `Binary Match`, and `Timeline` panels.
- [ ] Highlight relevant tables during simulation.

### Phase 11. URL State and Export/Import

- [ ] Export topology JSON.
- [ ] Import topology JSON.
- [ ] Save and load topology from Local Storage.
- [ ] Encode and decode share URLs with compressed state.

### Phase 12. Examples

- [ ] Add required example topologies.
- [ ] Ensure each example can be simulated immediately.

### Phase 13. Polish and Validation

- [ ] Add validation warnings.
- [ ] Add unsupported L2 loop detection.
- [ ] Improve inspector tables and selected field highlights.
- [ ] Add reset controls for dynamic tables and event logs.
