import { fireEvent, render, screen } from '@testing-library/react'
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

    expect(screen.getByText('Host A')).toBeInTheDocument()
    expect(screen.getByText('Switch S1')).toBeInTheDocument()
    expect(screen.getAllByText('Router R1').length).toBeGreaterThan(0)
    expect(useLabStore.getState().topology.nodes).toHaveLength(3)
  })

  test('loads the first milestone topology', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Load First Milestone' }),
    )

    expect(screen.getByText('Host A')).toBeInTheDocument()
    expect(screen.getByText('Router R1')).toBeInTheDocument()
    expect(screen.getByText('Host B')).toBeInTheDocument()
    expect(useLabStore.getState().topology.links).toHaveLength(4)
    expect(useLabStore.getState().topology.segments).toHaveLength(2)
  })
})
