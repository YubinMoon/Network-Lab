# 02. Architecture

## Layers

- `src/domain`: pure networking logic, validation, packet simulation, route lookup, ARP, L2, IP math.
- `src/store`: Zustand state orchestration and actions.
- `src/components`: React UI for canvas, inspector, packet generator, controls, and logs.
- `src/persistence`: URL hash encoding/decoding and schema handling.
- `src/examples`: reusable example topologies.
- `src/tests`: unit and UI regression tests.

Networking decisions should live in `src/domain`, not inside React components.

## State Model

- Persistent topology: nodes, links, interfaces, segments, settings, static/generated routes.
- Dynamic tables: ARP Cache and MAC Address Table values derived from simulation events.
- Playback state: current event index, animation state, selected object, panel layout, packet generator input.

Dynamic simulation state should be resettable and should not be treated as hand-authored topology data.

## Auto Configuration

`applyAutoConfiguration` performs:

- Link/interface synchronization.
- Network Segment detection.
- MAC/IP assignment.
- Host gateway derivation when a segment has a router.
- Connected route generation.
- `Auto Static` route generation.

Switches extend L2 segments. Routers split segments. Hosts do not forward.

## Simulation Flow

1. Validate unsupported L2 loops and invalid topology.
2. Select source host/interface and ARP target.
3. Emit ARP, switch learning, and flooding/forwarding events as needed.
4. Deliver to host or decapsulate at router.
5. Run route lookup with Longest Prefix Match and route type precedence.
6. Decrement TTL, resolve ARP, re-encapsulate, fragment if required, and forward.
7. Emit packet delivery or packet drop with details.
8. For ICMP Echo Request, generate Echo Reply using request-path dynamic tables.

## Persistence

- JSON export/import uses versioned topology state.
- Share URLs use compressed hash state.
- Local Storage persistence has been removed.

## Validation

Validation should block or explain:

- Unsupported L2 loops.
- Invalid interface IP/prefix configuration.
- Host gateway outside host subnet.
- Duplicate IP addresses where relevant.
- Link/interface down or lossy path drops during simulation.
