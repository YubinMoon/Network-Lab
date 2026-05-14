import { nanoid } from 'nanoid'
import { generateMac } from '../domain/mac'
import { applyNetworkSegments } from '../domain/segments'
import {
  DEFAULT_LAB_SETTINGS,
  type CanvasPosition,
  type HostNode,
  type LinkId,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type NodeId,
  type NodeType,
  type RouterNode,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'
import { create } from 'zustand'

export type LabSelection =
  | { kind: 'node'; id: NodeId }
  | { kind: 'link'; id: LinkId }
  | null

interface LabStoreState {
  topology: TopologyState
  selectedObject: LabSelection
  addNode: (type: NodeType) => void
  addLink: (sourceNodeId: NodeId, targetNodeId: NodeId) => void
  moveNode: (nodeId: NodeId, position: CanvasPosition) => void
  removeNode: (nodeId: NodeId) => void
  removeLink: (linkId: LinkId) => void
  deleteSelection: () => void
  selectNode: (nodeId: NodeId) => void
  selectLink: (linkId: LinkId) => void
  clearSelection: () => void
  clearTopology: () => void
  loadFirstMilestoneTopology: () => void
}

const emptyTopology = (): TopologyState => ({
  nodes: [],
  links: [],
  segments: [],
  settings: DEFAULT_LAB_SETTINGS,
})

export const useLabStore = create<LabStoreState>((set, get) => ({
  topology: emptyTopology(),
  selectedObject: null,

  addNode: (type) => {
    set((state) => {
      const node = createNode(type, state.topology.nodes)

      return {
        topology: applyNetworkSegments({
          ...state.topology,
          nodes: [...state.topology.nodes, node],
        }),
        selectedObject: { kind: 'node', id: node.id },
      }
    })
  },

  addLink: (sourceNodeId, targetNodeId) => {
    if (sourceNodeId === targetNodeId) {
      return
    }

    set((state) => {
      if (
        state.topology.links.some((link) =>
          linksSameNodes(link, sourceNodeId, targetNodeId),
        )
      ) {
        return state
      }

      const linkId = `link-${nanoid(8)}`
      const sourceNode = state.topology.nodes.find(
        (node) => node.id === sourceNodeId,
      )
      const targetNode = state.topology.nodes.find(
        (node) => node.id === targetNodeId,
      )

      if (!sourceNode || !targetNode) {
        return state
      }

      const sourceUpdate = attachInterfaceForLink(sourceNode, linkId)
      const targetUpdate = attachInterfaceForLink(targetNode, linkId)
      const link: NetworkLink = {
        id: linkId,
        endpointA: {
          nodeId: sourceNodeId,
          interfaceId: sourceUpdate.interfaceId,
        },
        endpointB: {
          nodeId: targetNodeId,
          interfaceId: targetUpdate.interfaceId,
        },
        status: 'up',
        delayMs: 100,
        lossRate: 0,
      }

      return {
        topology: applyNetworkSegments({
          ...state.topology,
          nodes: state.topology.nodes.map((node) => {
            if (node.id === sourceNodeId) {
              return sourceUpdate.node
            }

            if (node.id === targetNodeId) {
              return targetUpdate.node
            }

            return node
          }),
          links: [...state.topology.links, link],
        }),
        selectedObject: { kind: 'link', id: link.id },
      }
    })
  },

  moveNode: (nodeId, position) => {
    set((state) => ({
      topology: {
        ...state.topology,
        nodes: state.topology.nodes.map((node) =>
          node.id === nodeId ? { ...node, position } : node,
        ),
      },
    }))
  },

  removeNode: (nodeId) => {
    set((state) => {
      const removedLinkIds = state.topology.links
        .filter(
          (link) =>
            link.endpointA.nodeId === nodeId || link.endpointB.nodeId === nodeId,
        )
        .map((link) => link.id)
      const removedLinkSet = new Set(removedLinkIds)

      return {
        topology: applyNetworkSegments({
          ...state.topology,
          nodes: state.topology.nodes
            .filter((node) => node.id !== nodeId)
            .map((node) => detachLinksFromNode(node, removedLinkSet)),
          links: state.topology.links.filter(
            (link) => !removedLinkSet.has(link.id),
          ),
        }),
        selectedObject: null,
      }
    })
  },

  removeLink: (linkId) => {
    set((state) => ({
      topology: applyNetworkSegments({
        ...state.topology,
        nodes: state.topology.nodes.map((node) =>
          detachLinksFromNode(node, new Set([linkId])),
        ),
        links: state.topology.links.filter((link) => link.id !== linkId),
      }),
      selectedObject: null,
    }))
  },

  deleteSelection: () => {
    const selection = get().selectedObject

    if (selection?.kind === 'node') {
      get().removeNode(selection.id)
      return
    }

    if (selection?.kind === 'link') {
      get().removeLink(selection.id)
    }
  },

  selectNode: (nodeId) => {
    set({ selectedObject: { kind: 'node', id: nodeId } })
  },

  selectLink: (linkId) => {
    set({ selectedObject: { kind: 'link', id: linkId } })
  },

  clearSelection: () => {
    set({ selectedObject: null })
  },

  clearTopology: () => {
    set({ topology: emptyTopology(), selectedObject: null })
  },

  loadFirstMilestoneTopology: () => {
    set({
      topology: applyNetworkSegments(createFirstMilestoneTopology()),
      selectedObject: null,
    })
  },
}))

function createNode(type: NodeType, existingNodes: NetworkNode[]): NetworkNode {
  const index = existingNodes.filter((node) => node.type === type).length
  const id = `${type}-${nanoid(8)}`
  const position = nextPosition(existingNodes.length)

  if (type === 'host') {
    return {
      id,
      type,
      name: `Host ${hostLetter(index)}`,
      position,
      interfaces: [createInterface(id, 'eth0')],
      arpCache: [],
    } satisfies HostNode
  }

  if (type === 'switch') {
    return {
      id,
      type,
      name: `Switch S${index + 1}`,
      position,
      interfaces: [],
      macAddressTable: [],
    } satisfies SwitchNode
  }

  return {
    id,
    type,
    name: `Router R${index + 1}`,
    position,
    interfaces: [],
    routingTable: [],
    arpCache: [],
  } satisfies RouterNode
}

function nextPosition(index: number): CanvasPosition {
  return {
    x: 120 + (index % 4) * 180,
    y: 100 + Math.floor(index / 4) * 130,
  }
}

function hostLetter(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index)
  }

  return `${index + 1}`
}

function createInterface(
  nodeId: NodeId,
  name: string,
  connectedLinkIds: LinkId[] = [],
): NetworkInterface {
  return {
    id: `${nodeId}-${name.replaceAll('/', '-')}`,
    nodeId,
    name,
    macAddress: generateMac(`${nodeId}:${name}`),
    connectedLinkIds,
    status: 'up',
    autoAssigned: true,
    manualOverride: false,
  }
}

function attachInterfaceForLink(
  node: NetworkNode,
  linkId: LinkId,
): { node: NetworkNode; interfaceId: string } {
  if (node.type === 'host') {
    const existingInterface = node.interfaces[0] ?? createInterface(node.id, 'eth0')
    const updatedInterface = addLinkToInterface(existingInterface, linkId)

    return {
      node: {
        ...node,
        interfaces: [
          updatedInterface,
          ...node.interfaces.filter((iface) => iface.id !== existingInterface.id),
        ],
      },
      interfaceId: updatedInterface.id,
    }
  }

  const interfaceName =
    node.type === 'switch'
      ? `e0/${node.interfaces.length + 1}`
      : `g0/${node.interfaces.length}`
  const networkInterface = createInterface(node.id, interfaceName, [linkId])

  return {
    node: {
      ...node,
      interfaces: [...node.interfaces, networkInterface],
    },
    interfaceId: networkInterface.id,
  }
}

function addLinkToInterface(
  networkInterface: NetworkInterface,
  linkId: LinkId,
): NetworkInterface {
  return {
    ...networkInterface,
    connectedLinkIds: networkInterface.connectedLinkIds.includes(linkId)
      ? networkInterface.connectedLinkIds
      : [...networkInterface.connectedLinkIds, linkId],
  }
}

function detachLinksFromNode(
  node: NetworkNode,
  linkIds: Set<LinkId>,
): NetworkNode {
  const interfaces = node.interfaces
    .map((networkInterface) => ({
      ...networkInterface,
      connectedLinkIds: networkInterface.connectedLinkIds.filter(
        (linkId) => !linkIds.has(linkId),
      ),
    }))
    .filter(
      (networkInterface) =>
        node.type === 'host' || networkInterface.connectedLinkIds.length > 0,
    )

  return { ...node, interfaces }
}

function linksSameNodes(
  link: NetworkLink,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
): boolean {
  return (
    (link.endpointA.nodeId === sourceNodeId &&
      link.endpointB.nodeId === targetNodeId) ||
    (link.endpointA.nodeId === targetNodeId &&
      link.endpointB.nodeId === sourceNodeId)
  )
}

function createFirstMilestoneTopology(): TopologyState {
  const hostA = createNode('host', [])
  const switchS1 = createNode('switch', [hostA])
  const routerR1 = createNode('router', [hostA, switchS1])
  const switchS2 = createNode('switch', [hostA, switchS1, routerR1])
  const hostB = createNode('host', [hostA, switchS1, routerR1, switchS2])
  const nodeMap = new Map(
    [hostA, switchS1, routerR1, switchS2, hostB].map((node) => [node.id, node]),
  )
  const links: NetworkLink[] = []

  addTopologyLink(nodeMap, links, hostA.id, switchS1.id)
  addTopologyLink(nodeMap, links, switchS1.id, routerR1.id)
  addTopologyLink(nodeMap, links, routerR1.id, switchS2.id)
  addTopologyLink(nodeMap, links, switchS2.id, hostB.id)

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}

function addTopologyLink(
  nodeMap: Map<NodeId, NetworkNode>,
  links: NetworkLink[],
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
): void {
  const sourceNode = nodeMap.get(sourceNodeId)
  const targetNode = nodeMap.get(targetNodeId)

  if (!sourceNode || !targetNode) {
    return
  }

  const linkId = `link-${nanoid(8)}`
  const sourceUpdate = attachInterfaceForLink(sourceNode, linkId)
  const targetUpdate = attachInterfaceForLink(targetNode, linkId)

  nodeMap.set(sourceNodeId, sourceUpdate.node)
  nodeMap.set(targetNodeId, targetUpdate.node)
  links.push({
    id: linkId,
    endpointA: {
      nodeId: sourceNodeId,
      interfaceId: sourceUpdate.interfaceId,
    },
    endpointB: {
      nodeId: targetNodeId,
      interfaceId: targetUpdate.interfaceId,
    },
    status: 'up',
    delayMs: 100,
    lossRate: 0,
  })
}
