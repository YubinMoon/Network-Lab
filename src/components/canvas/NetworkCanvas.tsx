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
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo } from 'react'
import { useLabStore } from '../../store/useLabStore'
import { HostNode } from './HostNode'
import { LinkEdge } from './LinkEdge'
import { PacketToken } from './PacketToken'
import { RouterNode } from './RouterNode'
import { SwitchNode } from './SwitchNode'
import type { LabFlowEdge, LabFlowNode } from './flowTypes'
import { linkAnimationsForEvent } from './linkAnimation'

const nodeTypes = {
  host: HostNode,
  switch: SwitchNode,
  router: RouterNode,
} satisfies NodeTypes

const edgeTypes = {
  link: LinkEdge,
} satisfies EdgeTypes

export function NetworkCanvas() {
  return (
    <ReactFlowProvider>
      <NetworkCanvasFlow />
    </ReactFlowProvider>
  )
}

function NetworkCanvasFlow() {
  const topology = useLabStore((state) => state.topology)
  const selectedObject = useLabStore((state) => state.selectedObject)
  const addLink = useLabStore((state) => state.addLink)
  const moveNode = useLabStore((state) => state.moveNode)
  const selectNode = useLabStore((state) => state.selectNode)
  const selectLink = useLabStore((state) => state.selectLink)
  const clearSelection = useLabStore((state) => state.clearSelection)
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const canvasFitRequestId = useLabStore((state) => state.canvasFitRequestId)
  const { fitView } = useReactFlow()
  const currentEvent = simulationTrace?.events[currentEventIndex]
  const linkAnimations = useMemo(
    () => linkAnimationsForEvent(topology, currentEvent),
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
      topology.links.map((link) => {
        const animation = linkAnimations.get(link.id)

        return {
          id: link.id,
          source: link.endpointA.nodeId,
          target: link.endpointB.nodeId,
          type: 'link',
          selected: selectedObject?.kind === 'link' && selectedObject.id === link.id,
          data: {
            label: 'Link',
            status: link.status,
            active: Boolean(animation),
            selected: selectedObject?.kind === 'link' && selectedObject.id === link.id,
            direction: animation?.direction ?? 'source-to-target',
            packetKind: animation?.packetKind ?? 'generic-ipv4',
          },
        }
      }),
    [linkAnimations, selectedObject, topology.links],
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

  useEffect(() => {
    if (canvasFitRequestId === 0) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2 })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [canvasFitRequestId, fitView])

  return (
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
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
      <PacketToken />
    </ReactFlow>
  )
}
