import { Handle, Position } from '@xyflow/react'
import type { LabNodeData } from './flowTypes'

interface NetworkNodeCardProps {
  data: LabNodeData
  selected: boolean
  variant: 'host' | 'switch' | 'router'
}

export function NetworkNodeCard({
  data,
  selected,
  variant,
}: NetworkNodeCardProps) {
  return (
    <div className={`network-node-card ${variant} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-title">{data.label}</div>
      <div className="node-kind">{nodeLabel(data.nodeType)}</div>
      <ul className="node-interfaces" aria-label="Interface">
        {data.interfaces.length > 0 ? (
          data.interfaces.map((label) => <li key={label}>{label}</li>)
        ) : (
          <li>No Interface</li>
        )}
      </ul>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function nodeLabel(nodeType: string): string {
  if (nodeType === 'host') {
    return 'Host'
  }

  if (nodeType === 'switch') {
    return 'Switch'
  }

  return 'Router'
}
