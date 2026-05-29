import { describe, expect, test } from 'vitest'
import {
  decodeTopologyHash,
  encodeTopologyHash,
  topologyFromJson,
  topologyToJson,
} from '../persistence/urlState'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type TopologyState,
} from '../domain/types'

describe('Topology persistence', () => {
  test('round trips topology through JSON export and import', () => {
    const topology = sampleTopology()
    const json = topologyToJson(topology)

    expect(topologyFromJson(json)).toEqual(topology)
  })

  test('round trips topology through compressed URL hash state', () => {
    const topology = sampleTopology()
    const hash = encodeTopologyHash(topology)

    expect(hash.startsWith('#state=')).toBe(true)
    expect(decodeTopologyHash(hash)).toEqual(topology)
  })

})

function sampleTopology(): TopologyState {
  return {
    nodes: [
      {
        id: 'host-a',
        type: 'host',
        name: 'Host A',
        position: { x: 0, y: 0 },
        interfaces: [
          {
            id: 'host-a-eth0',
            nodeId: 'host-a',
            name: 'eth0',
            macAddress: '02:00:00:00:00:01',
            ipAddress: '10.0.1.10',
            prefixLength: 24,
            connectedLinkIds: [],
            status: 'up',
            autoAssigned: true,
            manualOverride: false,
          },
        ],
        arpCache: [],
      } satisfies HostNode,
    ],
    links: [],
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}
