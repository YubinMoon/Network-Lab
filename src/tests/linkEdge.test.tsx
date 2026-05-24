import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { LinkEdge } from '../components/canvas/LinkEdge'

vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ className }: { className?: string }) => (
    <path className={className} />
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
    ...overrides,
  }
}
