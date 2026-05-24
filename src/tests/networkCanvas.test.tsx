import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NetworkCanvas } from '../components/canvas/NetworkCanvas'
import { useLabStore } from '../store/useLabStore'

const reactFlowMock = vi.hoisted(() => ({
  fitView: vi.fn(),
  props: [] as Array<Record<string, unknown>>,
}))

vi.mock('@xyflow/react', () => ({
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  ReactFlow: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => {
    reactFlowMock.props.push(props)

    return <div data-testid="react-flow">{children}</div>
  },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  useReactFlow: () => ({
    fitView: reactFlowMock.fitView,
  }),
}))

describe('NetworkCanvas', () => {
  beforeEach(() => {
    reactFlowMock.fitView.mockClear()
    reactFlowMock.props = []
    useLabStore.getState().clearTopology()
  })

  test('does not ask React Flow to fit the view when adding a node', () => {
    render(<NetworkCanvas />)

    act(() => {
      useLabStore.getState().addNode('host')
    })

    expect(reactFlowMock.props.at(-1)).not.toHaveProperty('fitView')
    expect(reactFlowMock.fitView).not.toHaveBeenCalled()
  })

  test('still fits the view for explicit topology loads', async () => {
    render(<NetworkCanvas />)

    act(() => {
      useLabStore.getState().loadFirstMilestoneTopology()
    })

    await waitFor(() => {
      expect(reactFlowMock.fitView).toHaveBeenCalledWith({ padding: 0.2 })
    })
  })

  test('does not replay a previous fit request when adding another node', async () => {
    render(<NetworkCanvas />)

    act(() => {
      useLabStore.getState().loadFirstMilestoneTopology()
    })

    await waitFor(() => {
      expect(reactFlowMock.fitView).toHaveBeenCalledTimes(1)
    })

    reactFlowMock.fitView.mockClear()

    act(() => {
      useLabStore.getState().addNode('host')
    })

    await nextAnimationFrame()

    expect(reactFlowMock.fitView).not.toHaveBeenCalled()
  })
})

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}
