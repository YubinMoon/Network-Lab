import type { TopologyState } from '../domain/types'
import { topologyFromJson, topologyToJson } from './urlState'

export const LOCAL_STORAGE_KEY = 'ipv4-network-visualization-lab:topology'

export function saveTopologyToLocalStorage(
  topology: TopologyState,
  storage: Storage = localStorage,
): void {
  storage.setItem(LOCAL_STORAGE_KEY, topologyToJson(topology))
}

export function loadTopologyFromLocalStorage(
  storage: Storage = localStorage,
): TopologyState | undefined {
  const json = storage.getItem(LOCAL_STORAGE_KEY)

  return json ? topologyFromJson(json) : undefined
}
