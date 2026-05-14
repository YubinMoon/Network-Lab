import { isBroadcastMac, normalizeMac } from './mac'
import type {
  EthernetFrame,
  InterfaceId,
  MacTableEntry,
  SwitchNode,
} from './types'

export type SwitchForwardingKind =
  | 'broadcast-flooded'
  | 'unknown-unicast-flooded'
  | 'known-unicast-forwarded'

export interface SwitchForwardingDecision {
  kind: SwitchForwardingKind
  macAddressTable: MacTableEntry[]
  learnedEntry: MacTableEntry
  egressInterfaceIds: InterfaceId[]
}

export function processSwitchFrame(
  switchNode: SwitchNode,
  ingressInterfaceId: InterfaceId,
  frame: EthernetFrame,
): SwitchForwardingDecision {
  const macAddressTable = learnSourceMac(
    switchNode.macAddressTable,
    frame.srcMac,
    ingressInterfaceId,
  )
  const learnedEntry = findMacEntry(macAddressTable, frame.srcMac)
  const floodPorts = switchNode.interfaces
    .map((networkInterface) => networkInterface.id)
    .filter((interfaceId) => interfaceId !== ingressInterfaceId)

  if (isBroadcastMac(frame.dstMac)) {
    return {
      kind: 'broadcast-flooded',
      macAddressTable,
      learnedEntry: requireMacEntry(learnedEntry, frame.srcMac),
      egressInterfaceIds: floodPorts,
    }
  }

  const destinationEntry = findMacEntry(macAddressTable, frame.dstMac)

  if (!destinationEntry) {
    return {
      kind: 'unknown-unicast-flooded',
      macAddressTable,
      learnedEntry: requireMacEntry(learnedEntry, frame.srcMac),
      egressInterfaceIds: floodPorts,
    }
  }

  return {
    kind: 'known-unicast-forwarded',
    macAddressTable,
    learnedEntry: requireMacEntry(learnedEntry, frame.srcMac),
    egressInterfaceIds:
      destinationEntry.portInterfaceId === ingressInterfaceId
        ? []
        : [destinationEntry.portInterfaceId],
  }
}

export function learnSourceMac(
  macAddressTable: MacTableEntry[],
  sourceMac: string,
  ingressInterfaceId: InterfaceId,
): MacTableEntry[] {
  const normalizedSource = normalizeMac(sourceMac)
  const existing = macAddressTable.find(
    (entry) => normalizeMac(entry.macAddress) === normalizedSource,
  )

  if (existing) {
    return macAddressTable.map((entry) =>
      normalizeMac(entry.macAddress) === normalizedSource
        ? { ...entry, portInterfaceId: ingressInterfaceId, ageSeconds: 0 }
        : entry,
    )
  }

  return [
    ...macAddressTable,
    {
      macAddress: normalizedSource,
      portInterfaceId: ingressInterfaceId,
      ageSeconds: 0,
    },
  ]
}

function findMacEntry(
  macAddressTable: MacTableEntry[],
  macAddress: string,
): MacTableEntry | undefined {
  const normalizedMac = normalizeMac(macAddress)
  return macAddressTable.find(
    (candidate) => normalizeMac(candidate.macAddress) === normalizedMac,
  )
}

function requireMacEntry(
  entry: MacTableEntry | undefined,
  macAddress: string,
): MacTableEntry {
  if (!entry) {
    throw new Error(`Missing MAC table entry: ${macAddress}`)
  }

  return entry
}
