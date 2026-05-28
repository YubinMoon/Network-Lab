import { nanoid } from 'nanoid'
import { applyAutoConfiguration } from '../domain/autoConfig'
import { generateMac } from '../domain/mac'
import {
  DEFAULT_LAB_SETTINGS,
  DEFAULT_LINK_MTU,
  type CanvasPosition,
  type HostNode,
  type LinkId,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type NodeId,
  type NodeType,
  type PacketGeneratorInput,
  type PacketTrace,
  type RouteEntry,
  type RouterNode,
  type SimulationStatus,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'
import { create } from 'zustand'
import { applySimulationTraceToTopology } from '../domain/dynamicTables'
import { simulateIpv4PacketBatch } from '../domain/simulation'
import {
  decodeTopologyHash,
  encodeTopologyHash,
  topologyFromJson,
  topologyToJson,
} from '../persistence/urlState'
import {
  loadTopologyFromLocalStorage,
  saveTopologyToLocalStorage,
} from '../persistence/localStorage'
import type { ExampleTopology } from '../examples/topologies'

export type LabSelection =
  | { kind: 'node'; id: NodeId }
  | { kind: 'link'; id: LinkId }
  | null

interface LabStoreState {
  topology: TopologyState
  selectedObject: LabSelection
  simulationTrace: PacketTrace | null
  simulationBaseTopology: TopologyState | null
  simulationStatus: SimulationStatus
  currentEventIndex: number
  simulationSpeed: number
  canvasFitRequestId: number
  packetGeneratorInput: PacketGeneratorInput
  packetGeneratorInputRevision: number
  lastExportJson: string
  lastShareUrl: string
  addNode: (type: NodeType) => void
  addLink: (sourceNodeId: NodeId, targetNodeId: NodeId) => void
  moveNode: (nodeId: NodeId, position: CanvasPosition) => void
  removeNode: (nodeId: NodeId) => void
  removeLink: (linkId: LinkId) => void
  updateLinkMtu: (linkId: LinkId, mtu: number) => void
  addRouterRoute: (routerId: NodeId) => void
  updateRouterRoute: (
    routerId: NodeId,
    routeId: RouteEntry['id'],
    patch: EditableRoutePatch,
  ) => void
  removeRouterRoute: (routerId: NodeId, routeId: RouteEntry['id']) => void
  deleteSelection: () => void
  selectNode: (nodeId: NodeId) => void
  selectLink: (linkId: LinkId) => void
  clearSelection: () => void
  clearTopology: () => void
  resetDynamicTables: () => void
  clearSimulationTrace: () => void
  sendPacket: (input: PacketGeneratorInput) => void
  playSimulation: () => void
  pauseSimulation: () => void
  nextEvent: () => void
  previousEvent: () => void
  resetSimulation: () => void
  setSimulationSpeed: (speed: number) => void
  exportTopologyJson: () => void
  importTopologyJson: (json: string) => void
  saveTopology: () => void
  loadTopology: () => void
  createShareUrl: () => void
  loadTopologyFromHash: (hash: string) => void
  loadExampleTopology: (example: ExampleTopology) => void
}

type EditableRoutePatch = Partial<
  Pick<
    RouteEntry,
    | 'destinationNetwork'
    | 'prefixLength'
    | 'nextHopIp'
    | 'outInterfaceId'
    | 'metric'
    | 'type'
    | 'enabled'
  >
>

const emptyTopology = (): TopologyState => ({
  nodes: [],
  links: [],
  segments: [],
  settings: DEFAULT_LAB_SETTINGS,
})

const defaultPacketGeneratorInput = (): PacketGeneratorInput => ({
  sourceHostId: '',
  destinationMode: 'host',
  targetHostId: '',
  destinationIp: '',
  packetType: 'icmp-echo',
  ttl: DEFAULT_LAB_SETTINGS.defaultTtl,
  packetCount: 1,
  intervalMs: DEFAULT_LAB_SETTINGS.defaultPacketIntervalMs,
  payload: 'Hello',
})

function topologyForCurrentEvent(state: LabStoreState): TopologyState {
  if (!state.simulationBaseTopology || !state.simulationTrace) {
    return state.topology
  }

  return applySimulationTraceToTopology(
    state.simulationBaseTopology,
    state.simulationTrace,
    state.currentEventIndex,
  )
}

function updateNodePosition(
  topology: TopologyState,
  nodeId: NodeId,
  position: CanvasPosition,
): TopologyState {
  return {
    ...topology,
    nodes: topology.nodes.map((node) =>
      node.id === nodeId ? { ...node, position } : node,
    ),
  }
}

export const useLabStore = create<LabStoreState>((set, get) => ({
  topology: emptyTopology(),
  selectedObject: null,
  simulationTrace: null,
  simulationBaseTopology: null,
  simulationStatus: 'idle',
  currentEventIndex: 0,
  simulationSpeed: 1,
  canvasFitRequestId: 0,
  packetGeneratorInput: defaultPacketGeneratorInput(),
  packetGeneratorInputRevision: 0,
  lastExportJson: '',
  lastShareUrl: '',

  addNode: (type) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)
      const node = createNode(type, topology.nodes)

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: [...topology.nodes, node],
        }),
        selectedObject: { kind: 'node', id: node.id },
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  addLink: (sourceNodeId, targetNodeId) => {
    if (sourceNodeId === targetNodeId) {
      return
    }

    set((state) => {
      const topology = topologyForCurrentEvent(state)

      if (
        topology.links.some((link) =>
          linksSameNodes(link, sourceNodeId, targetNodeId),
        )
      ) {
        return state
      }

      const linkId = `link-${nanoid(8)}`
      const sourceNode = topology.nodes.find(
        (node) => node.id === sourceNodeId,
      )
      const targetNode = topology.nodes.find(
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
        mtu: DEFAULT_LINK_MTU,
      }

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes.map((node) => {
            if (node.id === sourceNodeId) {
              return sourceUpdate.node
            }

            if (node.id === targetNodeId) {
              return targetUpdate.node
            }

            return node
          }),
          links: [...topology.links, link],
        }),
        selectedObject: { kind: 'link', id: link.id },
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  moveNode: (nodeId, position) => {
    set((state) => ({
      topology: updateNodePosition(state.topology, nodeId, position),
      simulationBaseTopology: state.simulationBaseTopology
        ? updateNodePosition(state.simulationBaseTopology, nodeId, position)
        : null,
    }))
  },

  removeNode: (nodeId) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)
      const removedLinkIds = topology.links
        .filter(
          (link) =>
            link.endpointA.nodeId === nodeId || link.endpointB.nodeId === nodeId,
        )
        .map((link) => link.id)
      const removedLinkSet = new Set(removedLinkIds)

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes
            .filter((node) => node.id !== nodeId)
            .map((node) => detachLinksFromNode(node, removedLinkSet)),
          links: topology.links.filter(
            (link) => !removedLinkSet.has(link.id),
          ),
        }),
        selectedObject: null,
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  removeLink: (linkId) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes.map((node) =>
            detachLinksFromNode(node, new Set([linkId])),
          ),
          links: topology.links.filter((link) => link.id !== linkId),
        }),
        selectedObject: null,
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  updateLinkMtu: (linkId, mtu) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)
      const normalizedMtu = Number.isFinite(mtu)
        ? Math.max(28, Math.floor(mtu))
        : DEFAULT_LINK_MTU

      return {
        topology: {
          ...topology,
          links: topology.links.map((link) =>
            link.id === linkId
              ? { ...link, mtu: normalizedMtu }
              : link,
          ),
        },
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  addRouterRoute: (routerId) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)
      const router = topology.nodes.find(
        (node): node is RouterNode =>
          node.id === routerId && node.type === 'router',
      )
      const outInterface = router?.interfaces[0]

      if (!router || !outInterface) {
        return state
      }

      const route: RouteEntry = {
        id: `route-${routerId}-manual-${nanoid(8)}`,
        destinationNetwork: '10.0.0.0',
        prefixLength: 24,
        outInterfaceId: outInterface.id,
        type: 'manual-static',
        metric: 1,
        enabled: true,
      }

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes.map((node) =>
            node.id === routerId && node.type === 'router'
              ? { ...node, routingTable: [...node.routingTable, route] }
              : node,
          ),
        }),
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  updateRouterRoute: (routerId, routeId, patch) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes.map((node) =>
            node.id === routerId && node.type === 'router'
              ? {
                  ...node,
                  routingTable: node.routingTable.map((route) =>
                    route.id === routeId && editableRoute(route)
                      ? applyEditableRoutePatch(route, patch)
                      : route,
                  ),
                }
              : node,
          ),
        }),
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
  },

  removeRouterRoute: (routerId, routeId) => {
    set((state) => {
      const topology = topologyForCurrentEvent(state)

      return {
        topology: applyAutoConfiguration({
          ...topology,
          nodes: topology.nodes.map((node) =>
            node.id === routerId && node.type === 'router'
              ? {
                  ...node,
                  routingTable: node.routingTable.filter(
                    (route) => route.id !== routeId || !editableRoute(route),
                  ),
                }
              : node,
          ),
        }),
        simulationTrace: null,
        simulationBaseTopology: null,
        simulationStatus: 'idle',
        currentEventIndex: 0,
      }
    })
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
    set((state) => ({
      topology: emptyTopology(),
      selectedObject: null,
      simulationTrace: null,
      simulationBaseTopology: null,
      simulationStatus: 'idle',
      currentEventIndex: 0,
      packetGeneratorInput: defaultPacketGeneratorInput(),
      packetGeneratorInputRevision: state.packetGeneratorInputRevision + 1,
    }))
  },

  resetDynamicTables: () => {
    set((state) => ({
      topology: {
        ...state.topology,
        nodes: state.topology.nodes.map((node) => {
          if (node.type === 'host') {
            return { ...node, arpCache: [] }
          }

          if (node.type === 'switch') {
            return { ...node, macAddressTable: [] }
          }

          return { ...node, arpCache: [] }
        }),
      },
      simulationBaseTopology: null,
    }))
  },

  clearSimulationTrace: () => {
    set((state) => ({
      topology: topologyForCurrentEvent(state),
      simulationTrace: null,
      simulationBaseTopology: null,
      simulationStatus: 'idle',
      currentEventIndex: 0,
    }))
  },

  sendPacket: (input) => {
    const topology = topologyForCurrentEvent(get())
    const destinationIp =
      input.destinationMode === 'host'
        ? hostIpAddress(topology, input.targetHostId)
        : input.destinationIp

    if (!destinationIp) {
      return
    }

    const simulationTrace = simulateIpv4PacketBatch(topology, {
      sourceHostId: input.sourceHostId,
      destinationIp,
      ttl: input.ttl,
      packetType: input.packetType,
      payload: input.payload,
      packetCount: input.packetCount,
      intervalMs: input.intervalMs,
    })

    set({
      topology: applySimulationTraceToTopology(topology, simulationTrace),
      simulationTrace,
      simulationBaseTopology: topology,
      simulationStatus:
        simulationTrace.events.length > 0 ? 'paused' : 'completed',
      currentEventIndex: 0,
    })
  },

  playSimulation: () => {
    set((state) => ({
      simulationStatus: state.simulationTrace ? 'running' : 'idle',
    }))
  },

  pauseSimulation: () => {
    set((state) => ({
      simulationStatus: state.simulationTrace ? 'paused' : 'idle',
    }))
  },

  nextEvent: () => {
    set((state) => {
      const eventCount = state.simulationTrace?.events.length ?? 0
      const nextIndex = Math.min(state.currentEventIndex + 1, eventCount - 1)

      return {
        currentEventIndex: Math.max(nextIndex, 0),
        simulationStatus:
          eventCount > 0 && nextIndex >= eventCount - 1
            ? 'completed'
            : state.simulationStatus,
      }
    })
  },

  previousEvent: () => {
    set((state) => ({
      currentEventIndex: Math.max(state.currentEventIndex - 1, 0),
      simulationStatus: state.simulationTrace ? 'paused' : 'idle',
    }))
  },

  resetSimulation: () => {
    set((state) => ({
      currentEventIndex: 0,
      simulationStatus: state.simulationTrace ? 'paused' : 'idle',
    }))
  },

  setSimulationSpeed: (speed) => {
    set({ simulationSpeed: speed })
  },

  exportTopologyJson: () => {
    set((state) => ({
      lastExportJson: topologyToJson(topologyForCurrentEvent(state)),
    }))
  },

  importTopologyJson: (json) => {
    if (!json.trim()) {
      return
    }

    set((state) => ({
      topology: applyAutoConfiguration(topologyFromJson(json)),
      selectedObject: null,
      simulationTrace: null,
      simulationBaseTopology: null,
      simulationStatus: 'idle',
      currentEventIndex: 0,
      canvasFitRequestId: state.canvasFitRequestId + 1,
    }))
  },

  saveTopology: () => {
    saveTopologyToLocalStorage(topologyForCurrentEvent(get()))
  },

  loadTopology: () => {
    const topology = loadTopologyFromLocalStorage()

    if (!topology) {
      return
    }

    set((state) => ({
      topology: applyAutoConfiguration(topology),
      selectedObject: null,
      simulationTrace: null,
      simulationBaseTopology: null,
      simulationStatus: 'idle',
      currentEventIndex: 0,
      canvasFitRequestId: state.canvasFitRequestId + 1,
    }))
  },

  createShareUrl: () => {
    const hash = encodeTopologyHash(topologyForCurrentEvent(get()))
    const url =
      typeof window === 'undefined'
        ? hash
        : `${window.location.origin}${window.location.pathname}${hash}`

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hash)
    }

    set({ lastShareUrl: url })
  },

  loadTopologyFromHash: (hash) => {
    const topology = decodeTopologyHash(hash)

    if (!topology) {
      return
    }

    set((state) => ({
      topology: applyAutoConfiguration(topology),
      selectedObject: null,
      simulationTrace: null,
      simulationBaseTopology: null,
      simulationStatus: 'idle',
      currentEventIndex: 0,
      canvasFitRequestId: state.canvasFitRequestId + 1,
    }))
  },

  loadExampleTopology: (example) => {
    const topology = applyAutoConfiguration(example.topology)
    const destinationIp =
      example.packet.destinationMode === 'host'
        ? hostIpAddress(topology, example.packet.targetHostId)
        : example.packet.destinationIp
    const simulationTrace = destinationIp
      ? simulateIpv4PacketBatch(topology, {
          sourceHostId: example.packet.sourceHostId,
          destinationIp,
          ttl: example.packet.ttl,
          packetType: example.packet.packetType,
          payload: example.packet.payload,
          packetCount: example.packet.packetCount,
          intervalMs: example.packet.intervalMs,
        })
      : null

    set((state) => ({
      topology: simulationTrace
        ? applySimulationTraceToTopology(topology, simulationTrace)
        : topology,
      selectedObject: null,
      simulationTrace,
      simulationBaseTopology: simulationTrace ? topology : null,
      simulationStatus: simulationTrace ? 'paused' : 'idle',
      currentEventIndex: 0,
      canvasFitRequestId: state.canvasFitRequestId + 1,
      packetGeneratorInput: { ...example.packet },
      packetGeneratorInputRevision: state.packetGeneratorInputRevision + 1,
    }))
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

  const routerNumber = nextRouterNumber(existingNodes)

  return {
    id: `router-r${routerNumber}`,
    type,
    name: `Router R${routerNumber}`,
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

function nextRouterNumber(existingNodes: NetworkNode[]): number {
  const routerNumbers = existingNodes
    .filter((node) => node.type === 'router')
    .flatMap((node) => [
      numberedSuffix(node.name, /^Router R(\d+)$/),
      numberedSuffix(node.id, /^router-r(\d+)$/),
    ])
    .filter((value): value is number => value !== undefined)

  return Math.max(0, ...routerNumbers) + 1
}

function numberedSuffix(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern)
  const parsed = match ? Number(match[1]) : NaN

  return Number.isFinite(parsed) ? parsed : undefined
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
    const availableInterface = node.interfaces.find(
      (networkInterface) => networkInterface.connectedLinkIds.length === 0,
    )

    if (availableInterface) {
      const updatedInterface = addLinkToInterface(availableInterface, linkId)

      return {
        node: {
          ...node,
          interfaces: node.interfaces.map((networkInterface) =>
            networkInterface.id === updatedInterface.id
              ? updatedInterface
              : networkInterface,
          ),
        },
        interfaceId: updatedInterface.id,
      }
    }

    const networkInterface = createInterface(
      node.id,
      nextHostInterfaceName(node),
      [linkId],
    )

    return {
      node: {
        ...node,
        interfaces: [...node.interfaces, networkInterface],
      },
      interfaceId: networkInterface.id,
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

function nextHostInterfaceName(node: HostNode): string {
  let index = 0

  while (
    node.interfaces.some(
      (networkInterface) => networkInterface.name === `eth${index}`,
    )
  ) {
    index += 1
  }

  return `eth${index}`
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

function editableRoute(route: RouteEntry): boolean {
  return route.type === 'manual-static' || route.type === 'default'
}

function applyEditableRoutePatch(
  route: RouteEntry,
  patch: EditableRoutePatch,
): RouteEntry {
  const routeType =
    patch.type === 'default' || patch.type === 'manual-static'
      ? patch.type
      : route.type
  const metric =
    patch.metric === undefined
      ? route.metric
      : normalizeMetric(patch.metric)
  const nextHopIp =
    patch.nextHopIp === undefined ? route.nextHopIp : optionalText(patch.nextHopIp)

  return {
    ...route,
    ...patch,
    type: routeType,
    destinationNetwork:
      routeType === 'default'
        ? '0.0.0.0'
        : patch.destinationNetwork ?? route.destinationNetwork,
    prefixLength:
      routeType === 'default'
        ? 0
        : normalizePrefixLength(patch.prefixLength ?? route.prefixLength),
    nextHopIp,
    metric,
  }
}

function normalizePrefixLength(prefixLength: number): number {
  if (!Number.isFinite(prefixLength)) {
    return 0
  }

  return Math.min(32, Math.max(0, Math.floor(prefixLength)))
}

function normalizeMetric(metric: number): number {
  if (!Number.isFinite(metric)) {
    return 1
  }

  return Math.max(1, Math.floor(metric))
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()

  return trimmed ? trimmed : undefined
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

function hostIpAddress(
  topology: TopologyState,
  hostId: NodeId | undefined,
): string | undefined {
  const host = topology.nodes.find(
    (node): node is HostNode => node.type === 'host' && node.id === hostId,
  )

  return host?.interfaces[0]?.ipAddress
}
