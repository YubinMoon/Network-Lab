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
import { EXAMPLE_TOPOLOGIES } from '../examples/topologies'
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
    expect(
      screen.queryByRole('button', { name: 'Load First Milestone' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Primary' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Network Canvas')).toBeInTheDocument()
    expect(screen.getByLabelText('Simulation Panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveClass(
      'clear-topology-button',
    )
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(
      'packet-send-button',
    )

    const topBar = screen
      .getByRole('heading', { name: 'IPv4 Network Visualization Lab' })
      .closest('.top-bar')

    expect(topBar).not.toBeNull()
    expect(
      within(topBar as HTMLElement).getByLabelText('Simulation Controls'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Palette')).queryByLabelText(
        'Simulation Controls',
      ),
    ).not.toBeInTheDocument()
  })

  test('renders Event Log as the only bottom panel view', () => {
    render(<App />)

    const panel = screen.getByLabelText('Simulation Panel')

    expect(
      within(panel).getByRole('heading', { name: 'Event Log' }),
    ).toBeInTheDocument()
    expect(within(panel).getByLabelText('Event Log')).toBeInTheDocument()
    expect(
      within(panel).getByRole('button', { name: 'Clear Log' }),
    ).toHaveClass('simulation-clear-button')
    expect(within(panel).queryByText('Packet Trace')).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Timeline' }),
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Layer View' }),
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Packet Detail' }),
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Binary Match' }),
    ).not.toBeInTheDocument()
  })

  test('resizes left, bottom, and right workspace panels by dragging separators', () => {
    render(<App />)

    const workspace = screen.getByLabelText('Lab Workspace') as HTMLElement
    const leftResizer = screen.getByRole('separator', {
      name: 'Resize Left Panel',
    })
    const bottomResizer = screen.getByRole('separator', {
      name: 'Resize Bottom Panel',
    })
    const rightResizer = screen.getByRole('separator', {
      name: 'Resize Right Panel',
    })

    expect(workspace.style.getPropertyValue('--left-panel-width')).toBe('240px')
    expect(workspace.style.getPropertyValue('--right-panel-width')).toBe('360px')
    expect(workspace.style.getPropertyValue('--bottom-panel-height')).toBe(
      '320px',
    )

    fireEvent.pointerDown(leftResizer, { clientX: 240, clientY: 300 })
    fireEvent.pointerMove(window, { clientX: 300, clientY: 300 })
    fireEvent.pointerUp(window)

    expect(workspace.style.getPropertyValue('--left-panel-width')).toBe('300px')

    fireEvent.pointerDown(bottomResizer, { clientX: 600, clientY: 600 })
    fireEvent.pointerMove(window, { clientX: 600, clientY: 540 })
    fireEvent.pointerUp(window)

    expect(workspace.style.getPropertyValue('--bottom-panel-height')).toBe(
      '380px',
    )

    fireEvent.pointerDown(rightResizer, { clientX: 1000, clientY: 300 })
    fireEvent.pointerMove(window, { clientX: 930, clientY: 300 })
    fireEvent.pointerUp(window)

    expect(workspace.style.getPropertyValue('--right-panel-width')).toBe('430px')

    fireEvent.keyDown(leftResizer, { key: 'ArrowLeft' })
    fireEvent.keyDown(bottomResizer, { key: 'ArrowDown' })
    fireEvent.keyDown(rightResizer, { key: 'ArrowLeft' })

    expect(workspace.style.getPropertyValue('--left-panel-width')).toBe('276px')
    expect(workspace.style.getPropertyValue('--bottom-panel-height')).toBe(
      '356px',
    )
    expect(workspace.style.getPropertyValue('--right-panel-width')).toBe('454px')
    expect(leftResizer).toHaveAttribute('aria-valuenow', '276')
    expect(bottomResizer).toHaveAttribute('aria-valuenow', '356')
    expect(rightResizer).toHaveAttribute('aria-valuenow', '454')
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

  test('marks the clicked node card as selected', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Host' }))
    fireEvent.click(screen.getAllByText('Host A')[0])

    expect(
      screen
        .getAllByText('Host A')
        .some((element) =>
          element.closest('.network-node-card')?.classList.contains('selected'),
        ),
    ).toBe(true)
  })

  test('uses a new Host interface for an additional Host link', () => {
    act(() => {
      useLabStore.getState().addNode('host')
      useLabStore.getState().addNode('switch')
      useLabStore.getState().addNode('host')
      useLabStore.getState().addNode('host')
    })

    const hostA = nodeByName('Host A')
    const switchS1 = nodeByName('Switch S1')
    const hostB = nodeByName('Host B')
    const hostC = nodeByName('Host C')

    act(() => {
      useLabStore.getState().addLink(hostA.id, switchS1.id)
      useLabStore.getState().addLink(switchS1.id, hostB.id)
      useLabStore.getState().addLink(hostB.id, hostC.id)
    })

    const topology = useLabStore.getState().topology
    const updatedHostB = topology.nodes.find((node) => node.id === hostB.id)
    const updatedHostC = topology.nodes.find((node) => node.id === hostC.id)
    const switchSegment = topology.segments.find((segment) =>
      segment.memberInterfaceIds.includes(`${switchS1.id}-e0-2`),
    )
    const hostCSegment = topology.segments.find((segment) =>
      segment.memberInterfaceIds.includes(`${hostC.id}-eth0`),
    )

    expect(updatedHostB?.type).toBe('host')
    expect(updatedHostC?.type).toBe('host')

    if (updatedHostB?.type === 'host') {
      expect(updatedHostB.interfaces.map((networkInterface) => networkInterface.name)).toEqual([
        'eth0',
        'eth1',
      ])
      expect(updatedHostB.interfaces[0].connectedLinkIds).toHaveLength(1)
      expect(updatedHostB.interfaces[1].connectedLinkIds).toHaveLength(1)
    }

    expect(switchSegment?.memberInterfaceIds).toContain(`${hostB.id}-eth0`)
    expect(switchSegment?.memberInterfaceIds).not.toContain(`${hostB.id}-eth1`)
    expect(switchSegment?.memberInterfaceIds).not.toContain(`${hostC.id}-eth0`)
    expect(hostCSegment?.memberInterfaceIds).toEqual(
      expect.arrayContaining([`${hostB.id}-eth1`, `${hostC.id}-eth0`]),
    )
  })

  test('uses a new Host interface when extending a loaded example Host', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))

    act(() => {
      useLabStore.getState().addNode('host')
    })

    const hostC = nodeByName('Host C')

    act(() => {
      useLabStore.getState().addLink('host-b', hostC.id)
    })

    const topology = useLabStore.getState().topology
    const hostB = topology.nodes.find((node) => node.id === 'host-b')
    const switchSegment = topology.segments.find((segment) =>
      segment.memberInterfaceIds.includes('switch-s1-e0-2'),
    )
    const hostCSegment = topology.segments.find((segment) =>
      segment.memberInterfaceIds.includes(`${hostC.id}-eth0`),
    )

    expect(hostB?.type).toBe('host')

    if (hostB?.type === 'host') {
      expect(
        hostB.interfaces.map((networkInterface) => networkInterface.name),
      ).toEqual(['eth0', 'eth1'])
      expect(hostB.interfaces[0].connectedLinkIds).toEqual(['link-2'])
      expect(hostB.interfaces[1].connectedLinkIds).toHaveLength(1)
    }

    expect(switchSegment?.memberInterfaceIds).toContain('host-b-eth0')
    expect(switchSegment?.memberInterfaceIds).not.toContain('host-b-eth1')
    expect(switchSegment?.memberInterfaceIds).not.toContain(`${hostC.id}-eth0`)
    expect(hostCSegment?.memberInterfaceIds).toEqual(
      expect.arrayContaining(['host-b-eth1', `${hostC.id}-eth0`]),
    )

    act(() => {
      useLabStore.getState().sendPacket({
        sourceHostId: 'host-a',
        destinationMode: 'host',
        targetHostId: hostC.id,
        packetType: 'generic-ipv4',
        ttl: 64,
        packetCount: 1,
        intervalMs: 500,
        payload: 'Hello',
      })
    })

    const trace = useLabStore.getState().simulationTrace

    expect(trace?.result).toEqual({
      status: 'dropped',
      reason: 'No Default Gateway',
    })
    expect(trace?.events.some((event) => event.actorNodeId === hostC.id)).toBe(
      false,
    )
  })

  test('loads the default gateway example topology', () => {
    render(<App />)

    loadDefaultGatewayExample()

    expect(screen.getAllByText('Host A').length).toBeGreaterThan(0)
    expect(screen.getByText('Router R1')).toBeInTheDocument()
    expect(screen.getAllByText('Host B').length).toBeGreaterThan(0)
    expect(useLabStore.getState().topology.links).toHaveLength(4)
    expect(useLabStore.getState().topology.segments).toHaveLength(2)
  })

  test('loads fragmentation example packet defaults into the Packet Generator', () => {
    render(<App />)

    loadExampleById('fragmentation-random-routing')

    expect(screen.getByLabelText('Packet Type')).toHaveValue('generic-ipv4')
    expect(screen.getByLabelText('Packet Count')).toHaveValue(2)
    expect(screen.getByLabelText('Payload')).toHaveValue(
      'Fragmentation payload '.repeat(12),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      useLabStore
        .getState()
        .simulationTrace?.events.some(
          (event) => event.type === 'ipv4-datagram-fragmented',
        ),
    ).toBe(true)
  })

  test('continues Router names from the highest existing Router number', () => {
    act(() => {
      useLabStore.getState().addNode('router')
      useLabStore.getState().addNode('router')
      useLabStore.getState().addNode('router')
      useLabStore.getState().removeNode(nodeByName('Router R2').id)
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Router' }))
    fireEvent.click(screen.getByRole('button', { name: 'Router' }))

    const routerR4 = nodeByName('Router R4')
    const routerR5 = nodeByName('Router R5')

    expect(routerR4.id).toBe('router-r4')
    expect(routerR5.id).toBe('router-r5')
    expect(
      useLabStore
        .getState()
        .topology.nodes.filter((node) => node.name === 'Router R3'),
    ).toHaveLength(1)
    expect(screen.getAllByText('Router R4').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Router R5').length).toBeGreaterThan(0)
  })

  test('uses sequential Router IDs in generated interface IDs', () => {
    act(() => {
      useLabStore.getState().loadExampleTopology(defaultGatewayExample())
      useLabStore.getState().addNode('router')
      useLabStore.getState().addLink('router-r2', nodeByName('Switch S2').id)
    })

    const routerR2 = nodeByName('Router R2')

    expect(routerR2.type).toBe('router')

    if (routerR2.type === 'router') {
      expect(routerR2.interfaces[0].id).toBe('router-r2-g0-0')
      expect(routerR2.routingTable[0].outInterfaceId).toBe('router-r2-g0-0')
    }
  })

  test('hides normal link status labels by default', () => {
    const { container } = render(<App />)

    loadDefaultGatewayExample()

    expect(container.querySelector('.link-edge-label')).not.toBeInTheDocument()
  })

  test('uses one colored playback toggle button', () => {
    render(<App />)

    const initialPlayButton = screen.getByRole('button', { name: 'Play' })
    const controlButtons = within(
      screen.getByLabelText('Simulation Controls'),
    ).getAllByRole('button')
    const topBar = initialPlayButton.closest('.top-bar')

    expect(initialPlayButton).toHaveClass('play')
    expect(topBar).not.toBeNull()
    expect(controlButtons.slice(0, 2).map((button) => button.textContent)).toEqual(
      ['Play', 'Reset'],
    )
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveClass(
      'simulation-reset-button',
    )
    expect(
      screen.getByRole('button', { name: 'Reset Dynamic Tables' }),
    ).toHaveClass('simulation-reset-button')
    expect(screen.getByRole('button', { name: 'Previous Event' })).toHaveClass(
      'simulation-step-button',
    )
    expect(screen.getByRole('button', { name: 'Next Event' })).toHaveClass(
      'simulation-step-button',
    )
    expect(screen.getByRole('button', { name: 'Clear Log' })).toHaveClass(
      'simulation-clear-button',
    )
    expect(
      within(topBar as HTMLElement).queryByRole('button', { name: 'Clear Log' }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Simulation Panel')).getByRole('button', {
        name: 'Clear Log',
      }),
    ).toBeInTheDocument()
    const speedSelect = within(topBar as HTMLElement).getByLabelText('Speed')

    expect(speedSelect).toBeInTheDocument()
    expect(initialPlayButton.previousElementSibling).toBe(speedSelect)
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()

    loadDefaultGatewayExample()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    const traceBeforePlay = useLabStore.getState().simulationTrace

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    const pauseButton = screen.getByRole('button', { name: 'Pause' })

    expect(useLabStore.getState().simulationTrace).toBe(traceBeforePlay)
    expect(pauseButton).toHaveClass('pause')
    expect(useLabStore.getState().simulationStatus).toBe('running')

    fireEvent.click(pauseButton)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('play')
    expect(useLabStore.getState().simulationStatus).toBe('paused')
  })

  test('creates the Event Log from the current Packet Generator input when Play starts idle', () => {
    render(<App />)

    loadDefaultGatewayExample()

    act(() => {
      useLabStore.getState().clearSimulationTrace()
    })

    expect(useLabStore.getState().simulationTrace).toBeNull()
    expect(screen.getByText('Simulation idle.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Payload'), {
      target: { value: 'Play starts send' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    const trace = useLabStore.getState().simulationTrace

    expect(trace?.events.length).toBeGreaterThan(0)
    expect(
      trace?.events.some((event) => event.description.includes('Host A')),
    ).toBe(true)
    expect(useLabStore.getState().packetGeneratorInput.payload).toBe(
      'Play starts send',
    )
    expect(useLabStore.getState().simulationStatus).toBe('running')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  test('does not show endpoint MAC addresses for switch interfaces', () => {
    render(<App />)

    loadDefaultGatewayExample()

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

  test('edits Manual Static routes from the Router Inspector', () => {
    render(<App />)

    loadDefaultGatewayExample()

    act(() => {
      useLabStore.getState().selectNode('router-r1')
    })

    const routingSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'Routing Table',
    )

    expect(
      within(routingSection).queryByRole('button', {
        name: 'Add Manual Static',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(routingSection).queryByLabelText('Destination Network'),
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(routingSection).getByRole('button', {
        name: 'Edit Routing Table',
      }),
    )

    const addManualStaticButton = within(routingSection).getByRole('button', {
      name: 'Add Manual Static',
    })

    expect(
      within(routingSection).getByRole('button', { name: 'Done Editing' }),
    ).toBeInTheDocument()
    expect(addManualStaticButton).toBeEnabled()

    fireEvent.click(addManualStaticButton)
    const destinationInputs =
      within(routingSection).getAllByLabelText('Destination Network')
    const prefixInputs = within(routingSection).getAllByLabelText('Prefix Length')
    const nextHopInputs = within(routingSection).getAllByLabelText('Next Hop')
    const addedRouteIndex = destinationInputs.length - 1

    fireEvent.change(destinationInputs[addedRouteIndex], {
      target: { value: '10.20.30.0' },
    })
    fireEvent.change(prefixInputs[addedRouteIndex], {
      target: { value: '24' },
    })
    fireEvent.change(nextHopInputs[addedRouteIndex], {
      target: { value: '10.0.1.2' },
    })

    const routerR1 = useLabStore
      .getState()
      .topology.nodes.find((node) => node.id === 'router-r1')
    const manualRoute =
      routerR1?.type === 'router'
        ? routerR1.routingTable.find((route) => route.type === 'manual-static')
        : undefined

    expect(manualRoute).toEqual(
      expect.objectContaining({
        destinationNetwork: '10.20.30.0',
        prefixLength: 24,
        nextHopIp: '10.0.1.2',
      }),
    )

    const deleteButtons = within(routingSection).getAllByRole('button', {
      name: 'Delete',
    })

    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    const updatedRouterR1 = useLabStore
      .getState()
      .topology.nodes.find((node) => node.id === 'router-r1')

    expect(
      updatedRouterR1?.type === 'router'
        ? updatedRouterR1.routingTable.some(
            (route) => route.type === 'manual-static',
          )
        : true,
    ).toBe(false)
  })

  test('edits generated Router routes and rebuilds them from Reset Dynamic Tables', () => {
    render(<App />)

    loadDefaultGatewayExample()

    act(() => {
      useLabStore.getState().selectNode('router-r1')
    })

    const routingSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'Routing Table',
    )
    const routerR1 = routerById('router-r1')
    const generatedRouteIndex = routerR1.routingTable.findIndex(
      (route) => route.type === 'connected',
    )
    const generatedRoute = routerR1.routingTable[generatedRouteIndex]

    expect(generatedRoute).toBeTruthy()

    expect(
      within(routingSection).getByText(
        `${generatedRoute.destinationNetwork}/${generatedRoute.prefixLength}`,
      ),
    ).toBeInTheDocument()
    expect(
      within(routingSection).queryByLabelText('Destination Network'),
    ).not.toBeInTheDocument()
    expect(
      within(routingSection).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(routingSection).getByRole('button', {
        name: 'Edit Routing Table',
      }),
    )

    const generatedDestinationInput =
      within(routingSection).getAllByLabelText('Destination Network')[
        generatedRouteIndex
      ]
    const generatedDeleteButton =
      within(routingSection).getAllByRole('button', { name: 'Delete' })[
        generatedRouteIndex
      ]

    expect(generatedDestinationInput).toBeEnabled()
    expect(generatedDeleteButton).toBeEnabled()

    fireEvent.change(generatedDestinationInput, {
      target: { value: '10.99.0.0' },
    })
    expect(
      within(routingSection).queryByLabelText('Route Type'),
    ).not.toBeInTheDocument()

    expect(routerById('router-r1').routingTable[generatedRouteIndex]).toEqual(
      expect.objectContaining({
        destinationNetwork: '10.99.0.0',
        type: 'connected',
      }),
    )

    fireEvent.click(generatedDeleteButton)

    expect(
      routerById('router-r1').routingTable.some(
        (route) => route.id === generatedRoute.id,
      ),
    ).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dynamic Tables' }))

    expect(routerById('router-r1').routingTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationNetwork: generatedRoute.destinationNetwork,
          prefixLength: generatedRoute.prefixLength,
          type: 'connected',
        }),
      ]),
    )
  })

  test('shows Inspector ARP Cache entries only after their update event', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))

    const trace = useLabStore.getState().simulationTrace
    const missIndex =
      trace?.events.findIndex(
        (event) =>
          event.type === 'arp-cache-miss' && event.actorNodeId === 'host-a',
      ) ?? -1
    const updateIndex =
      trace?.events.findIndex(
        (event) =>
          event.type === 'arp-cache-updated' && event.actorNodeId === 'host-a',
      ) ?? -1
    const updateIpAddress = trace?.events[updateIndex]?.details?.ipAddress

    expect(missIndex).toBeGreaterThanOrEqual(0)
    expect(updateIndex).toBeGreaterThan(missIndex)
    expect(typeof updateIpAddress).toBe('string')

    act(() => {
      useLabStore.getState().selectNode('host-a')

      for (let index = 0; index < missIndex; index += 1) {
        useLabStore.getState().nextEvent()
      }
    })

    let arpCacheSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'ARP Cache',
    )

    expect(within(arpCacheSection).getByText('0 entries')).toBeInTheDocument()

    act(() => {
      for (let index = missIndex; index < updateIndex; index += 1) {
        useLabStore.getState().nextEvent()
      }
    })

    arpCacheSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'ARP Cache',
    )

    expect(
      within(arpCacheSection).getByText(updateIpAddress as string),
    ).toBeInTheDocument()
  })

  test('shows detailed packet headers for a selected active Link', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))

    const trace = useLabStore.getState().simulationTrace
    const arpRequestIndex =
      trace?.events.findIndex(
        (event) =>
          event.type === 'arp-request-sent' && event.actorNodeId === 'host-a',
      ) ?? -1
    const deliveredIndex =
      trace?.events.findIndex(
        (event) =>
          event.type === 'packet-delivered' && event.actorNodeId === 'host-b',
      ) ?? -1

    expect(arpRequestIndex).toBeGreaterThanOrEqual(0)
    expect(deliveredIndex).toBeGreaterThan(arpRequestIndex)

    act(() => {
      useLabStore.getState().selectLink('link-1')

      for (let index = 0; index < arpRequestIndex; index += 1) {
        useLabStore.getState().nextEvent()
      }
    })

    let packetSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'Packet on Link',
    )

    expect(within(packetSection).getByText('Ethernet Header')).toBeInTheDocument()
    expect(within(packetSection).getByText('ARP Header')).toBeInTheDocument()
    expect(within(packetSection).queryByText('Transit')).not.toBeInTheDocument()
    expect(within(packetSection).getByText('FF:FF:FF:FF:FF:FF')).toBeInTheDocument()
    expect(within(packetSection).getByText('10.0.1.10')).toBeInTheDocument()
    expect(within(packetSection).getByText('10.0.1.11')).toBeInTheDocument()

    act(() => {
      useLabStore.getState().selectLink('link-2')

      for (let index = arpRequestIndex; index < deliveredIndex; index += 1) {
        useLabStore.getState().nextEvent()
      }
    })

    packetSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'Packet on Link',
    )

    expect(
      within(screen.getByLabelText('Inspector')).getByLabelText('MTU'),
    ).toHaveValue(1500)
    expect(within(packetSection).getByText('IPv4 Header')).toBeInTheDocument()
    expect(within(packetSection).getByText('ICMP Header')).toBeInTheDocument()
    expect(within(packetSection).queryByText('Transit')).not.toBeInTheDocument()
    expect(
      within(packetSection).getByText('Reserved=0, DF=0, MF=0 (0x0000)'),
    ).toBeInTheDocument()
    expect(within(packetSection).getByText('0 (0 bytes)')).toBeInTheDocument()
    expect(
      within(packetSection).getByText(/^0x[0-9A-F]{4}$/),
    ).toBeInTheDocument()
    expect(within(packetSection).getByText('ICMP (1)')).toBeInTheDocument()
    expect(within(packetSection).getByText('Echo Request (8)')).toBeInTheDocument()
    expect(within(packetSection).getByText('Hello')).toBeInTheDocument()
  })

  test('does not keep hidden final ARP Cache entries after editing a loaded example', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))

    act(() => {
      useLabStore.getState().addNode('host')
    })

    const newHostId = useLabStore
      .getState()
      .topology.nodes.find((node) => node.name === 'Host C')?.id

    expect(newHostId).toBeTruthy()

    act(() => {
      useLabStore.getState().addLink(newHostId ?? '', 'switch-s1')
      useLabStore.getState().selectNode('host-a')
    })

    const hostA = useLabStore
      .getState()
      .topology.nodes.find((node) => node.id === 'host-a')

    expect(hostA?.type).toBe('host')

    if (hostA?.type === 'host') {
      expect(hostA.arpCache).toHaveLength(0)
    }

    const arpCacheSection = sectionByHeading(
      screen.getByLabelText('Inspector'),
      'ARP Cache',
    )

    expect(within(arpCacheSection).getByText('0 entries')).toBeInTheDocument()
  })

  test('sends a packet from the Packet Generator', () => {
    render(<App />)

    loadDefaultGatewayExample()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(useLabStore.getState().simulationTrace?.result.status).toBe(
      'delivered',
    )
    expect(screen.getAllByText(/delivered IPv4 Datagram/).length).toBeGreaterThan(
      0,
    )
  })

  test('hides JSON import and export controls while keeping Share URL', async () => {
    render(<App />)

    loadDefaultGatewayExample()

    expect(
      screen.queryByRole('button', { name: 'Export JSON' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Import JSON' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Share URL' }))

    await waitFor(() => {
      const textArea = screen.getByLabelText('Share URL') as HTMLTextAreaElement

      expect(textArea.value).toContain('#state=')
      expect(textArea.value).toContain(window.location.origin)
    })
  })
})

function sectionByHeading(container: HTMLElement, name: string): HTMLElement {
  const section = within(container)
    .getByRole('heading', { name })
    .closest('section')

  if (!section) {
    throw new Error(`Missing section ${name}`)
  }

  return section
}

function loadDefaultGatewayExample(): void {
  loadExampleById('default-gateway')
}

function loadExampleById(exampleId: string): void {
  const examples = within(screen.getByLabelText('Examples'))

  fireEvent.change(examples.getByRole('combobox'), {
    target: { value: exampleId },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))
}

function defaultGatewayExample() {
  const example = EXAMPLE_TOPOLOGIES.find(
    (candidate) => candidate.id === 'default-gateway',
  )

  if (!example) {
    throw new Error('Missing default-gateway example')
  }

  return example
}

function nodeByName(name: string) {
  const node = useLabStore
    .getState()
    .topology.nodes.find((candidate) => candidate.name === name)

  if (!node) {
    throw new Error(`Missing node ${name}`)
  }

  return node
}

function routerById(routerId: string) {
  const node = useLabStore
    .getState()
    .topology.nodes.find((candidate) => candidate.id === routerId)

  if (!node || node.type !== 'router') {
    throw new Error(`Missing router ${routerId}`)
  }

  return node
}
