import type { Edge, Node } from '@xyflow/react'
import type { NodeType } from '../../domain/types'

export interface LabNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  interfaces: string[]
  active: boolean
}

export interface LabEdgeData extends Record<string, unknown> {
  label: string
  status: string
  active: boolean
}

export type LabFlowNode = Node<LabNodeData, NodeType>
export type LabFlowEdge = Edge<LabEdgeData, 'link'>
