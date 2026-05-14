import type { NodeProps } from '@xyflow/react'
import { NetworkNodeCard } from './NetworkNodeCard'
import type { LabFlowNode } from './flowTypes'

export function RouterNode({ data, selected }: NodeProps<LabFlowNode>) {
  return <NetworkNodeCard data={data} selected={selected} variant="router" />
}
