import type {
  InterfaceId,
  NetworkInterface,
  NetworkNode,
} from './types'

export function collectInterfaceOwnerMap<T>(
  nodes: NetworkNode[],
  selectValue: (
    node: NetworkNode,
    networkInterface: NetworkInterface,
    nodeIndex: number,
  ) => T,
): Map<InterfaceId, T> {
  const owners = new Map<InterfaceId, T>()

  nodes.forEach((node, nodeIndex) => {
    for (const networkInterface of node.interfaces) {
      owners.set(
        networkInterface.id,
        selectValue(node, networkInterface, nodeIndex),
      )
    }
  })

  return owners
}

