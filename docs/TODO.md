# TODO

This file tracks current and planned work for the IPv4 Network Visualization Lab.

## Working Rules

- Keep planned items small enough to verify with one concrete check.
- Move finished work into `Completed Summary`.
- Do not mix unrelated work in one commit.

## In Progress

- README example topology/link-share section is being edited.

## Planned Work

- Add final Share URL links to README example entries after the pages are prepared.

## Completed Summary

- 2026-06-01: Removed visible `Export JSON` and `Import JSON` controls from the Share panel, leaving `Share URL`.
- 2026-06-01: Added packet-type Link movement colors for ARP, ICMP, and Generic IPv4 packets, with color readability coverage.
- 2026-06-01: Moved the `Speed` dropdown to the left of the `Play` button, with UI regression coverage.
- 2026-06-01: Moved `Clear Log` into the top-right of the bottom `Event Log` panel, with UI regression coverage.
- 2026-05-29: Styled top title bar `Previous Event` and `Next Event` controls as blue navigation buttons, with regression tests.
- 2026-05-29: Styled top title bar `Reset` controls as yellow warning buttons and `Clear Log` as a red destructive button, with regression tests.
- 2026-05-29: Compressed `docs` into concise current-reference files and summarized historical TODO entries.
- 2026-05-29: Removed `Save Local` and `Load Local`, deleted Local Storage persistence code, updated tests and docs.
- 2026-05-29: Updated ARP behavior so ARP Request recipients learn requester IP/MAC before replying, and ICMP Echo Reply uses request-path dynamic tables.
- 2026-05-29: Refreshed README with Korean overview, demo/project image, routing-focused copy, and example topology recommendations.
- 2026-05-29: Completed routing table editor/read-only behavior, generated route pruning, `Auto Static` route fixes, and route helper refactors.
- 2026-05-29: Completed resizable Palette/Event Log/Inspector panels and moved playback/log/speed controls into the title bar.
- 2026-05-26: Added Docker/Nginx runtime image and GHCR publishing workflow.
- 2026-05-25: Added MTU fragmentation, router mesh examples, random/equal-route forwarding behavior, packet batch cache carryover, active link packet inspection, and related UI polish.
- 2026-05-24: Improved event-indexed Inspector tables, playback controls, validation display, link labels, and example dynamic-table behavior.
- 2026-05-22: Fixed example loading layout and directional packet animation on links.
- 2026-05-14 to 2026-05-15: Built the first complete lab: Vite/React/TypeScript bootstrap, topology editor, segment detection, auto IP/MAC/host gateway, routing, L2 switching, ARP, IPv4 forwarding, ICMP, event log, packet details, URL sharing, examples, validation, and final audit.
