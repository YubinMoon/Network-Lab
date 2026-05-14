import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { simulateIpv4Packet } from '../domain/simulation'
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

      const trace = simulateIpv4Packet(topology, {
        sourceHostId: example.packet.sourceHostId,
        destinationIp: destinationIp ?? '0.0.0.0',
        ttl: example.packet.ttl,
        packetType: example.packet.packetType,
        payload: example.packet.payload,
      })

      expect(trace.events.length, example.name).toBeGreaterThan(0)
    }
  })
})
