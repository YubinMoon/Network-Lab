import { describe, expect, test, vi } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { simulateIpv4PacketBatch } from '../domain/simulation'
import type { LinkEndpoint, TopologyState } from '../domain/types'
import { validateTopology } from '../domain/validation'
import { EXAMPLE_TOPOLOGIES } from '../examples/topologies'

const requiredExampleNames = [
  'Same LAN Communication',
  'Default Gateway Forwarding',
  'Router-to-Router Forwarding',
  'MTU Fragmentation and Random Routing',
  'Redundant Router Mesh',
  'No Matching Route',
]

describe('Example topologies', () => {
  test('includes every required example', () => {
    expect(EXAMPLE_TOPOLOGIES.map((example) => example.name)).toEqual(
      requiredExampleNames,
    )
  })

  test('does not expose duplicate physical topologies', () => {
    const signatures = EXAMPLE_TOPOLOGIES.map((example) =>
      physicalTopologySignature(example.topology),
    )

    expect(new Set(signatures).size).toBe(signatures.length)
  })

  test('each example loads and can produce an initial packet trace', () => {
    for (const example of EXAMPLE_TOPOLOGIES) {
      const topology = applyAutoConfiguration(example.topology)
      const destinationIp =
        example.packet.destinationMode === 'host'
          ? topology.nodes
              .find((node) => node.id === example.packet.targetHostId)
              ?.interfaces[0]?.ipAddress
          : example.packet.destinationIp

      expect(destinationIp, example.name).toBeTruthy()

      const trace = simulateIpv4PacketBatch(topology, {
        sourceHostId: example.packet.sourceHostId,
        destinationIp: destinationIp ?? '0.0.0.0',
        ttl: example.packet.ttl,
        packetType: example.packet.packetType,
        payload: example.packet.payload,
        packetCount: example.packet.packetCount,
        intervalMs: example.packet.intervalMs,
      })

      expect(trace.events.length, example.name).toBeGreaterThan(0)
    }
  })

  test('each example lays out linked nodes far enough apart', () => {
    for (const example of EXAMPLE_TOPOLOGIES) {
      const nodeById = new Map(
        example.topology.nodes.map((node) => [node.id, node]),
      )
      const positions = example.topology.nodes.map(
        (node) => `${node.position.x},${node.position.y}`,
      )

      expect(new Set(positions).size, example.name).toBe(positions.length)

      for (const link of example.topology.links) {
        const sourceNode = nodeById.get(link.endpointA.nodeId)
        const targetNode = nodeById.get(link.endpointB.nodeId)

        expect(sourceNode, `${example.name} ${link.id}`).toBeTruthy()
        expect(targetNode, `${example.name} ${link.id}`).toBeTruthy()

        if (!sourceNode || !targetNode) {
          continue
        }

        expect(
          Math.hypot(
            sourceNode.position.x - targetNode.position.x,
            sourceNode.position.y - targetNode.position.y,
          ),
          `${example.name} ${link.id}`,
        ).toBeGreaterThanOrEqual(180)
      }
    }
  })

  test('each example assigns unique endpoint MAC addresses', () => {
    for (const example of EXAMPLE_TOPOLOGIES) {
      const topology = applyAutoConfiguration(example.topology)
      const endpointMacAddresses = topology.nodes
        .filter((node) => node.type !== 'switch')
        .flatMap((node) =>
          node.interfaces.map((networkInterface) => networkInterface.macAddress),
        )

      expect(new Set(endpointMacAddresses).size, example.name).toBe(
        endpointMacAddresses.length,
      )
      expect(
        validateTopology(topology).map((issue) => issue.code),
        example.name,
      ).not.toContain('duplicate-mac-address')
    }
  })

  test('fragmentation example can randomly use equal routes and emit fragment events', () => {
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValue(0)
    const example = EXAMPLE_TOPOLOGIES.find(
      (candidate) => candidate.id === 'fragmentation-random-routing',
    )

    try {
      expect(example).toBeTruthy()

      if (!example) {
        return
      }

      const topology = applyAutoConfiguration(example.topology)
      const destinationIp = topology.nodes
        .find((node) => node.id === example.packet.targetHostId)
        ?.interfaces[0]?.ipAddress

      expect(destinationIp).toBe('10.0.2.10')

      const trace = simulateIpv4PacketBatch(topology, {
        sourceHostId: example.packet.sourceHostId,
        destinationIp: destinationIp ?? '0.0.0.0',
        ttl: example.packet.ttl,
        packetType: example.packet.packetType,
        payload: example.packet.payload,
        packetCount: example.packet.packetCount,
        intervalMs: example.packet.intervalMs,
      })
      const r1RouteIds = trace.events
        .filter(
          (event) =>
            event.type === 'router-route-selected' &&
            event.actorNodeId === 'router-r1',
        )
        .map((event) => (event.details?.selectedRoute as { id: string }).id)
      const fragmentEvents = trace.events.filter(
        (event) => event.type === 'ipv4-datagram-fragmented',
      )

      expect(trace.result.status).toBe('delivered')
      expect(r1RouteIds).toEqual([
        'route-r1-manual-via-r2',
        'route-r1-manual-via-r3',
      ])
      expect(fragmentEvents.map((event) => event.details?.mtu)).toEqual([80, 120])
      expect(
        fragmentEvents.every(
          (event) =>
            Array.isArray(event.details?.fragments) &&
            event.details.fragments.length > 1,
        ),
      ).toBe(true)
    } finally {
      randomSpy.mockRestore()
    }
  })

  test('redundant router mesh example uses two Hosts and nine Routers', () => {
    const example = EXAMPLE_TOPOLOGIES.find(
      (candidate) => candidate.id === 'redundant-router-mesh',
    )

    expect(example).toBeTruthy()

    if (!example) {
      return
    }

    expect(
      example.topology.nodes.filter((node) => node.type === 'host'),
    ).toHaveLength(2)
    expect(
      example.topology.nodes.filter((node) => node.type === 'router').length,
    ).toBe(9)
    expect(example.topology.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        'router-r1',
        'router-r2',
        'router-r3',
        'router-r4',
        'router-r5',
        'router-r6',
        'router-r7',
        'router-r8',
        'router-r9',
      ]),
    )
  })

  test('redundant router mesh example can deliver across the Router mesh', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const example = EXAMPLE_TOPOLOGIES.find(
      (candidate) => candidate.id === 'redundant-router-mesh',
    )

    try {
      expect(example).toBeTruthy()

      if (!example) {
        return
      }

      const topology = applyAutoConfiguration(example.topology)
      const destinationIp = topology.nodes
        .find((node) => node.id === example.packet.targetHostId)
        ?.interfaces[0]?.ipAddress

      expect(destinationIp).toBe('10.0.2.10')

      const trace = simulateIpv4PacketBatch(topology, {
        sourceHostId: example.packet.sourceHostId,
        destinationIp: destinationIp ?? '0.0.0.0',
        ttl: example.packet.ttl,
        packetType: example.packet.packetType,
        payload: example.packet.payload,
        packetCount: example.packet.packetCount,
        intervalMs: example.packet.intervalMs,
      })
      const traversedRouters = new Set(
        trace.events
          .filter((event) => event.type === 'router-next-hop-selected')
          .map((event) => event.actorNodeId),
      )

      expect(trace.result.status).toBe('delivered')
      expect(traversedRouters.size).toBeGreaterThanOrEqual(3)
    } finally {
      randomSpy.mockRestore()
    }
  })
})

function physicalTopologySignature(topology: TopologyState): string {
  const nodes = topology.nodes
    .map(
      (node) =>
        `${node.id}:${node.type}:${node.interfaces
          .map((networkInterface) => networkInterface.name)
          .join(',')}`,
    )
    .sort()
  const links = topology.links
    .map((networkLink) =>
      [endpointSignature(networkLink.endpointA), endpointSignature(networkLink.endpointB)]
        .sort()
        .join('--'),
    )
    .sort()

  return `${nodes.join('|')}::${links.join('|')}`
}

function endpointSignature(endpoint: LinkEndpoint): string {
  return `${endpoint.nodeId}:${endpoint.interfaceId}`
}
