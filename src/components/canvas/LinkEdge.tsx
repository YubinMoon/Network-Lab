import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { LabFlowEdge } from './flowTypes'

export function LinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LabFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const [reverseEdgePath] = getBezierPath({
    sourceX: targetX,
    sourceY: targetY,
    sourcePosition: targetPosition,
    targetX: sourceX,
    targetY: sourceY,
    targetPosition: sourcePosition,
  })
  const animationPath =
    data?.direction === 'target-to-source' ? reverseEdgePath : edgePath

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={linkClassName(Boolean(selected), Boolean(data?.active))}
      />
      {data?.active ? (
        <circle className="link-packet-dot" r="5">
          <animateMotion dur="900ms" repeatCount="indefinite" path={animationPath} />
        </circle>
      ) : null}
      <EdgeLabelRenderer>
        <span
          className="link-edge-label"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {data?.label ?? 'Link'} - {data?.status ?? 'up'}
        </span>
      </EdgeLabelRenderer>
    </>
  )
}

function linkClassName(selected: boolean, active: boolean): string {
  return ['link-edge', selected ? 'selected' : '', active ? 'moving' : '']
    .filter(Boolean)
    .join(' ')
}
