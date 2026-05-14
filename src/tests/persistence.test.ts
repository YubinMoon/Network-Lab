import { describe, expect, test } from 'vitest'
import {
  decodeTopologyHash,
  encodeTopologyHash,
  topologyFromJson,
  topologyToJson,
} from '../persistence/urlState'
import {
  LOCAL_STORAGE_KEY,
  loadTopologyFromLocalStorage,
  saveTopologyToLocalStorage,
} from '../persistence/localStorage'
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

  test('round trips topology through Local Storage', () => {
    const topology = sampleTopology()
    const storage = new MemoryStorage()

    saveTopologyToLocalStorage(topology, storage)

    expect(storage.getItem(LOCAL_STORAGE_KEY)).toContain('"schemaVersion"')
    expect(loadTopologyFromLocalStorage(storage)).toEqual(topology)
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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}
