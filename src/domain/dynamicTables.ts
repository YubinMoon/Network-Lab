import { updateArpCache } from './arp'
import { learnSourceMac } from './l2'
import type { PacketTrace, TopologyState } from './types'

export function applySimulationTraceToTopology(
  topology: TopologyState,
  packetTrace: PacketTrace,
): TopologyState {
  const arpCacheByNodeId = new Map(
    topology.nodes
      .filter((node) => node.type === 'host' || node.type === 'router')
      .map((node) => [node.id, node.arpCache] as const),
  )
  const macTableBySwitchId = new Map(
    topology.nodes
      .filter((node) => node.type === 'switch')
      .map((node) => [node.id, node.macAddressTable] as const),
  )

  for (const event of packetTrace.events) {
    if (event.type === 'arp-cache-updated' && event.actorNodeId) {
      const ipAddress = stringDetail(event.details, 'ipAddress')
      const macAddress = stringDetail(event.details, 'macAddress')
      const interfaceId = stringDetail(event.details, 'interfaceId')

      if (ipAddress && macAddress && interfaceId) {
        arpCacheByNodeId.set(
          event.actorNodeId,
          updateArpCache(arpCacheByNodeId.get(event.actorNodeId) ?? [], {
            ipAddress,
            macAddress,
            interfaceId,
          }),
        )
      }
    }

    if (event.type === 'switch-source-mac-learned' && event.actorNodeId) {
      const macAddress = stringDetail(event.details, 'macAddress')
      const portInterfaceId = stringDetail(event.details, 'portInterfaceId')

      if (macAddress && portInterfaceId) {
        macTableBySwitchId.set(
          event.actorNodeId,
          learnSourceMac(
            macTableBySwitchId.get(event.actorNodeId) ?? [],
            macAddress,
            portInterfaceId,
          ),
        )
      }
    }
  }

  return {
    ...topology,
    nodes: topology.nodes.map((node) => {
      if (node.type === 'host' || node.type === 'router') {
        return {
          ...node,
          arpCache: arpCacheByNodeId.get(node.id) ?? node.arpCache,
        }
      }

      return {
        ...node,
        macAddressTable:
          macTableBySwitchId.get(node.id) ?? node.macAddressTable,
      }
    }),
  }
}

function stringDetail(
  details: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key]

  return typeof value === 'string' ? value : undefined
}
