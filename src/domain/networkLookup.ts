import { normalizeMac } from './mac'
import type {
  NetworkInterface,
  NetworkNode,
  TopologyState,
} from './types'

export interface LocatedInterface {
  node: NetworkNode
  networkInterface: NetworkInterface
}

type InterfacePredicate = (networkInterface: NetworkInterface) => boolean

function findLocatedInterface(
  topology: TopologyState,
  matches: InterfacePredicate,
): LocatedInterface | undefined {
  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      if (matches(networkInterface)) {
        return { node, networkInterface }
      }
    }
  }

  return undefined
}

export function interfaceByIp(
  topology: TopologyState,
  ipAddress: string,
): LocatedInterface | undefined {
  return findLocatedInterface(topology, (networkInterface) =>
    networkInterface.ipAddress === ipAddress,
  )
}

export function interfaceByMac(
  topology: TopologyState,
  macAddress: string,
): LocatedInterface | undefined {
  const normalizedMacAddress = normalizeMac(macAddress)

  return findLocatedInterface(topology, (networkInterface) =>
    normalizeMac(networkInterface.macAddress) === normalizedMacAddress,
  )
}
