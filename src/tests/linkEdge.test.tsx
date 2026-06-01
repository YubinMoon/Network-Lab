import { render, screen } from '@testing-library/react'
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { LinkEdge } from '../components/canvas/LinkEdge'
import { LINK_PACKET_COLORS } from '../components/canvas/packetVisuals'

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({
    className,
    style,
  }: {
    className?: string
    style?: CSSProperties
  }) => (
    <path data-testid="base-edge" className={className} style={style} />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children,
  getBezierPath: () => ['M 0 0 L 100 0', 50, 0],
}))

describe('LinkEdge', () => {
  test('hides the normal up label when the link is not selected', () => {
    renderLinkEdge()

    expect(screen.queryByText('Link - up')).not.toBeInTheDocument()
  })

  test('shows the up label when the link is selected', () => {
    renderLinkEdge({ data: edgeData({ selected: true }) })

    expect(screen.getByText('Link - up')).toBeInTheDocument()
  })

  test('shows the down label even when the link is not selected', () => {
    renderLinkEdge({ data: edgeData({ status: 'down' }) })

    expect(screen.getByText('Link - down')).toBeInTheDocument()
  })

  test('applies the packet color to an active moving edge and packet dot', () => {
    const { container } = renderLinkEdge({
      data: edgeData({ active: true, packetKind: 'icmp' }),
    })

    const edge = screen.getByTestId('base-edge')
    const dot = container.querySelector('.link-packet-dot') as SVGCircleElement

    expect(edge).toHaveClass('link-edge', 'moving')
    expect(edge.style.getPropertyValue('--link-packet-color')).toBe(
      LINK_PACKET_COLORS.icmp,
    )
    expect(dot.style.getPropertyValue('--link-packet-color')).toBe(
      LINK_PACKET_COLORS.icmp,
    )
  })
})

function renderLinkEdge(overrides: Partial<ComponentProps<typeof LinkEdge>> = {}) {
  return render(<LinkEdge {...edgeProps(overrides)} />)
}

function edgeProps(
  overrides: Partial<ComponentProps<typeof LinkEdge>>,
): ComponentProps<typeof LinkEdge> {
  return {
    id: 'link-1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    sourcePosition: 'right',
    targetPosition: 'left',
    selected: false,
    data: edgeData(),
    ...overrides,
  } as ComponentProps<typeof LinkEdge>
}

function edgeData(
  overrides: Partial<ComponentProps<typeof LinkEdge>['data']> = {},
): NonNullable<ComponentProps<typeof LinkEdge>['data']> {
  return {
    label: 'Link',
    status: 'up',
    active: false,
    selected: false,
    direction: 'source-to-target',
    packetKind: 'generic-ipv4',
    ...overrides,
  }
}
