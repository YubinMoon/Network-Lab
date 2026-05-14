import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import type { PersistedLabState, TopologyState } from '../domain/types'
import { SCHEMA_VERSION } from './schemaVersion'

const STATE_PREFIX = '#state='

export function toPersistedLabState(topology: TopologyState): PersistedLabState {
  return {
    schemaVersion: SCHEMA_VERSION,
    topology,
  }
}

export function topologyToJson(topology: TopologyState): string {
  return JSON.stringify(toPersistedLabState(topology), null, 2)
}

export function topologyFromJson(json: string): TopologyState {
  const parsed = JSON.parse(json) as PersistedLabState

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${parsed.schemaVersion}`)
  }

  return parsed.topology
}

export function encodeTopologyHash(topology: TopologyState): string {
  return `${STATE_PREFIX}${compressToEncodedURIComponent(topologyToJson(topology))}`
}

export function decodeTopologyHash(hash: string): TopologyState | undefined {
  if (!hash.startsWith(STATE_PREFIX)) {
    return undefined
  }

  const decompressed = decompressFromEncodedURIComponent(
    hash.slice(STATE_PREFIX.length),
  )

  if (!decompressed) {
    return undefined
  }

  return topologyFromJson(decompressed)
}
