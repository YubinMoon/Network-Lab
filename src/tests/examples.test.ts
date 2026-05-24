import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { simulateIpv4PacketBatch } from '../domain/simulation'
import { validateTopology } from '../domain/validation'
import { EXAMPLE_TOPOLOGIES } from '../examples/topologies'

const requiredExampleNames = [
  'Same LAN Communication',
  'ARP Cache Hit vs Miss',
  'Switch MAC Learning',
  'Default Gateway Forwarding',
  'Router-to-Router Forwarding',
  'Longest Prefix Match',
  'No Matching Route',
  'TTL Expired Loop',
  'Link Loss and Unreliable Delivery',
  'Multiple Datagrams and Connectionless Delivery',
]

describe('Example topologies', () => {
  test('includes every required example', () => {
    expect(EXAMPLE_TOPOLOGIES.map((example) => example.name)).toEqual(
      requiredExampleNames,
    )
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
})
