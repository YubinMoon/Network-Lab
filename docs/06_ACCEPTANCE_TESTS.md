# 06. Acceptance Tests

Use this as a compact manual and automated acceptance checklist.

## Automated Checks

```bash
npm run test
npm run build
```

Expected result: all tests pass and production build completes.

## Core Scenarios

### Same LAN ARP

Topology: `Host A - Switch S1 - Host B`

Verify:

- ARP Request broadcasts.
- ARP Reply unicasts.
- Switch learns source MAC addresses.
- ARP Cache and MAC Address Table update at the correct event index.

### One Router Forwarding

Topology: `Host A - Switch S1 - Router R1 - Switch S2 - Host B`

Verify:

- Two LAN segments are detected.
- IP addresses and routes are generated.
- Host ARPs for next hop.
- Router decapsulates, decrements TTL, selects a route, ARPs on egress segment, and re-encapsulates.
- ICMP Echo Reply returns using learned dynamic tables where applicable.

### Router-to-Router

Topology: `Host A - R1 - R2 - Host B` with optional switches at host LANs.

Verify:

- Point-to-point segment addressing.
- Connected and `Auto Static` routes.
- `Next Hop` and `Out Interface` selection at each router.

### Fragmentation

Topology: path with a low-MTU link.

Verify:

- Large Generic IPv4 packet fragments.
- Fragment offsets and MF flag are visible.
- Reassembly event appears at destination.

### Drop Cases

Verify at least:

- `No Matching Route`
- `TTL Expired`
- `No ARP Reply`
- `Interface Down`
- `Link Down` or `Link Loss`
- `Unsupported L2 Loop`

Every drop must include an Event Log entry and drop reason.

## UI Checks

- Technical labels remain English.
- Packet movement is visible on active links.
- Inspector updates with selected node/link and current event.
- `Routing Table`, `ARP Cache`, and `MAC Address Table` highlights match the selected event.
- Share URL remains available.
- Export JSON and Import JSON buttons are not present.
- `Save Local` and `Load Local` are not present.
