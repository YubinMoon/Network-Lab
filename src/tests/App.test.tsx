import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import App from '../App'
import { useLabStore } from '../store/useLabStore'

describe('App', () => {
  beforeEach(() => {
    useLabStore.getState().clearTopology()
  })

  test('renders the lab shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'IPv4 Network Visualization Lab',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Host' })).toBeInTheDocument()
    expect(screen.getByLabelText('Network Canvas')).toBeInTheDocument()
    expect(screen.getByLabelText('Simulation Panel')).toBeInTheDocument()
  })

  test('adds nodes to the topology store from the Palette', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Host' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Router' }))

    expect(screen.getAllByText('Host A').length).toBeGreaterThan(0)
    expect(screen.getByText('Switch S1')).toBeInTheDocument()
    expect(screen.getAllByText('Router R1').length).toBeGreaterThan(0)
    expect(useLabStore.getState().topology.nodes).toHaveLength(3)
  })

  test('loads the first milestone topology', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )

    expect(screen.getAllByText('Host A').length).toBeGreaterThan(0)
    expect(screen.getByText('Router R1')).toBeInTheDocument()
    expect(screen.getAllByText('Host B').length).toBeGreaterThan(0)
    expect(useLabStore.getState().topology.links).toHaveLength(4)
    expect(useLabStore.getState().topology.segments).toHaveLength(2)
  })

  test('hides normal link status labels by default', () => {
    const { container } = render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )

    expect(container.querySelector('.link-edge-label')).not.toBeInTheDocument()
  })

  test('uses one colored playback toggle button', () => {
    render(<App />)

    const initialPlayButton = screen.getByRole('button', { name: 'Play' })
    const controlButtons = within(
      screen.getByLabelText('Simulation Controls'),
    ).getAllByRole('button')

    expect(initialPlayButton).toHaveClass('play')
    expect(controlButtons.slice(0, 2).map((button) => button.textContent)).toEqual(
      ['Play', 'Reset'],
    )
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    const pauseButton = screen.getByRole('button', { name: 'Pause' })

    expect(pauseButton).toHaveClass('pause')
    expect(useLabStore.getState().simulationStatus).toBe('running')

    fireEvent.click(pauseButton)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('play')
    expect(useLabStore.getState().simulationStatus).toBe('paused')
  })

  test('does not show endpoint MAC addresses for switch interfaces', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )

    const switchId = useLabStore
      .getState()
      .topology.nodes.find((node) => node.type === 'switch')?.id

    expect(switchId).toBeTruthy()

    act(() => {
      useLabStore.getState().selectNode(switchId ?? '')
    })

    const inspector = within(screen.getByLabelText('Inspector'))

    expect(inspector.getByText('e0/1')).toBeInTheDocument()
    expect(
      inspector.queryByRole('columnheader', { name: 'MAC Address' }),
    ).not.toBeInTheDocument()
  })

  test('sends a packet from the Packet Generator', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(useLabStore.getState().simulationTrace?.result.status).toBe(
      'delivered',
    )
    expect(screen.getAllByText(/delivered IPv4 Datagram/).length).toBeGreaterThan(
      0,
    )
  })

  test('imports the visible JSON after exporting a topology', async () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))

    await waitFor(() => {
      const textArea = screen.getByLabelText('Import JSON') as HTMLTextAreaElement

      expect(textArea.value).toContain('Host A')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(useLabStore.getState().topology.nodes).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }))

    expect(useLabStore.getState().topology.nodes).toHaveLength(5)
    expect(screen.getAllByText('Host A').length).toBeGreaterThan(0)
  })
})
