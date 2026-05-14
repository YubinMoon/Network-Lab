import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import { useCallback, useMemo } from 'react'
import { useLabStore } from '../../store/useLabStore'
import { HostNode } from './HostNode'
import { LinkEdge } from './LinkEdge'
import { PacketToken } from './PacketToken'
import { RouterNode } from './RouterNode'
import { SwitchNode } from './SwitchNode'
import type { LabFlowEdge, LabFlowNode } from './flowTypes'
import type { LinkId, SimulationEvent, TopologyState } from '../../domain/types'

const nodeTypes = {
  host: HostNode,
  switch: SwitchNode,
  router: RouterNode,
} satisfies NodeTypes

const edgeTypes = {
  link: LinkEdge,
} satisfies EdgeTypes

export function NetworkCanvas() {
  const topology = useLabStore((state) => state.topology)
  const selectedObject = useLabStore((state) => state.selectedObject)
  const addLink = useLabStore((state) => state.addLink)
  const moveNode = useLabStore((state) => state.moveNode)
  const selectNode = useLabStore((state) => state.selectNode)
  const selectLink = useLabStore((state) => state.selectLink)
  const clearSelection = useLabStore((state) => state.clearSelection)
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const currentEvent = simulationTrace?.events[currentEventIndex]
  const activeLinkIds = useMemo(
    () => activeLinkIdsForEvent(topology, currentEvent),
    [currentEvent, topology],
  )

  const flowNodes = useMemo<LabFlowNode[]>(
    () =>
      topology.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        selected: selectedObject?.kind === 'node' && selectedObject.id === node.id,
        data: {
          label: node.name,
          nodeType: node.type,
          active: currentEvent?.actorNodeId === node.id,
          interfaces: node.interfaces.map(
            (networkInterface) =>
              networkInterface.ipAddress && networkInterface.prefixLength
                ? `${networkInterface.name} ${networkInterface.ipAddress}/${networkInterface.prefixLength}`
                : networkInterface.name,
          ),
        },
      })),
    [currentEvent, selectedObject, topology.nodes],
  )
  const flowEdges = useMemo<LabFlowEdge[]>(
    () =>
      topology.links.map((link) => ({
        id: link.id,
        source: link.endpointA.nodeId,
        target: link.endpointB.nodeId,
        type: 'link',
        selected: selectedObject?.kind === 'link' && selectedObject.id === link.id,
        data: {
          label: 'Link',
          status: link.status,
          active: activeLinkIds.has(link.id),
        },
      })),
    [activeLinkIds, selectedObject, topology.links],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addLink(connection.source, connection.target)
      }
    },
    [addLink],
  )
  const onNodesChange = useCallback(
    (changes: NodeChange<LabFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position)
        }
      }
    },
    [moveNode],
  )

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectLink(edge.id)}
        onPaneClick={clearSelection}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
        <PacketToken />
      </ReactFlow>
    </ReactFlowProvider>
  )
}

function activeLinkIdsForEvent(
  topology: TopologyState,
  event: SimulationEvent | undefined,
): Set<LinkId> {
  const activeLinkIds = new Set<LinkId>()

  if (!event) {
    return activeLinkIds
  }

  const addInterfaceLinks = (interfaceId: string | undefined) => {
    if (!interfaceId) {
      return
    }

    for (const networkLink of topology.links) {
      if (
        networkLink.endpointA.interfaceId === interfaceId ||
        networkLink.endpointB.interfaceId === interfaceId
      ) {
        activeLinkIds.add(networkLink.id)
      }
    }
  }
  const addNodeLinks = (nodeId: string | undefined) => {
    if (!nodeId) {
      return
    }

    for (const networkLink of topology.links) {
      if (
        networkLink.endpointA.nodeId === nodeId ||
        networkLink.endpointB.nodeId === nodeId
      ) {
        activeLinkIds.add(networkLink.id)
      }
    }
  }

  addInterfaceLinks(stringDetail(event.details, 'ingressInterfaceId'))
  addInterfaceLinks(stringDetail(event.details, 'outInterfaceId'))

  for (const interfaceId of stringArrayDetail(event.details, 'egressInterfaceIds')) {
    addInterfaceLinks(interfaceId)
  }

  if (
    event.type === 'arp-request-sent' ||
    event.type === 'arp-reply-sent' ||
    event.type === 'packet-delivered' ||
    event.type === 'packet-dropped'
  ) {
    addNodeLinks(event.actorNodeId)
  }

  return activeLinkIds
}

function stringDetail(
  details: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = details?.[key]

  return typeof value === 'string' ? value : undefined
}

function stringArrayDetail(
  details: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = details?.[key]

  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : []
}
