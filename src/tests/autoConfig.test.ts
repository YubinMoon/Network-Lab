import { describe, expect, test } from 'vitest'
import { applyAutoConfiguration } from '../domain/autoConfig'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type InterfaceId,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type NetworkNode,
  type RouterNode,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'

describe('Auto IP/MAC/Gateway assignment', () => {
  test('assigns LAN host, router, and default gateway addresses', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const routerR1 = router('router-r1', 'Router R1', ['g0/0'])
    const configured = applyAutoConfiguration(
      topologyState(
        [hostA, switchS1, routerR1],
        [
          link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
          link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
        ],
      ),
    )

    expect(configured.segments[0]).toEqual(
      expect.objectContaining({
        networkAddress: '10.0.1.0',
        prefixLength: 24,
        defaultGatewayIp: '10.0.1.1',
        primaryRouterInterfaceId: 'router-r1-g0-0',
      }),
    )
    expect(interfaceByName(configured, 'host-a', 'eth0')).toEqual(
      expect.objectContaining({
        ipAddress: '10.0.1.10',
        prefixLength: 24,
      }),
    )
    expect(interfaceByName(configured, 'router-r1', 'g0/0')).toEqual(
      expect.objectContaining({
        ipAddress: '10.0.1.1',
        prefixLength: 24,
      }),
    )
    expect(hostById(configured, 'host-a').defaultGatewayIp).toBe('10.0.1.1')
  })

  test('assigns host addresses without a gateway when no router is present', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const hostB = host('host-b', 'Host B')
    const configured = applyAutoConfiguration(
      topologyState(
        [hostA, switchS1, hostB],
        [
          link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
          link('link-2', endpoint(switchS1, 'e0/2'), endpoint(hostB, 'eth0')),
        ],
      ),
    )

    expect(interfaceByName(configured, 'host-a', 'eth0').ipAddress).toBe(
      '10.0.1.10',
    )
    expect(interfaceByName(configured, 'host-b', 'eth0').ipAddress).toBe(
      '10.0.1.11',
    )
    expect(hostById(configured, 'host-a').defaultGatewayIp).toBeUndefined()
    expect(hostById(configured, 'host-b').defaultGatewayIp).toBeUndefined()
  })

  test('assigns both LANs in the first milestone topology', () => {
    const hostA = host('host-a', 'Host A')
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const routerR1 = router('router-r1', 'Router R1', ['g0/0', 'g0/1'])
    const switchS2 = switchNode('switch-s2', 'Switch S2', ['e0/1', 'e0/2'])
    const hostB = host('host-b', 'Host B')
    const configured = applyAutoConfiguration(
      topologyState(
        [hostA, switchS1, routerR1, switchS2, hostB],
        [
          link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
          link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
          link('link-3', endpoint(routerR1, 'g0/1'), endpoint(switchS2, 'e0/1')),
          link('link-4', endpoint(switchS2, 'e0/2'), endpoint(hostB, 'eth0')),
        ],
      ),
    )

    expect(configured.segments.map((segment) => segment.networkAddress)).toEqual([
      '10.0.1.0',
      '10.0.2.0',
    ])
    expect(interfaceByName(configured, 'host-a', 'eth0').ipAddress).toBe(
      '10.0.1.10',
    )
    expect(interfaceByName(configured, 'router-r1', 'g0/0').ipAddress).toBe(
      '10.0.1.1',
    )
    expect(interfaceByName(configured, 'router-r1', 'g0/1').ipAddress).toBe(
      '10.0.2.1',
    )
    expect(interfaceByName(configured, 'host-b', 'eth0').ipAddress).toBe(
      '10.0.2.10',
    )
    expect(hostById(configured, 'host-a').defaultGatewayIp).toBe('10.0.1.1')
    expect(hostById(configured, 'host-b').defaultGatewayIp).toBe('10.0.2.1')
  })

  test('preserves manually overridden interface addresses', () => {
    const hostA = host('host-a', 'Host A', {
      ipAddress: '192.168.10.50',
      prefixLength: 24,
      manualOverride: true,
    })
    const switchS1 = switchNode('switch-s1', 'Switch S1', ['e0/1', 'e0/2'])
    const routerR1 = router('router-r1', 'Router R1', ['g0/0'])
    const configured = applyAutoConfiguration(
      topologyState(
        [hostA, switchS1, routerR1],
        [
          link('link-1', endpoint(hostA, 'eth0'), endpoint(switchS1, 'e0/1')),
          link('link-2', endpoint(switchS1, 'e0/2'), endpoint(routerR1, 'g0/0')),
        ],
      ),
    )

    expect(interfaceByName(configured, 'host-a', 'eth0')).toEqual(
      expect.objectContaining({
        ipAddress: '192.168.10.50',
        prefixLength: 24,
      }),
    )
  })
})

function topologyState(
  nodes: NetworkNode[],
  links: NetworkLink[],
): TopologyState {
  return {
    nodes,
    links,
    segments: [],
    settings: DEFAULT_LAB_SETTINGS,
  }
}

function host(
  id: string,
  name: string,
  overrides: Partial<NetworkInterface> = {},
): HostNode {
  return {
    id,
    type: 'host',
    name,
    position: { x: 0, y: 0 },
    interfaces: [networkInterface(id, 'eth0', overrides)],
    arpCache: [],
  }
}

function switchNode(
  id: string,
  name: string,
  interfaceNames: string[],
): SwitchNode {
  return {
    id,
    type: 'switch',
    name,
    position: { x: 0, y: 0 },
    interfaces: interfaceNames.map((interfaceName) =>
      networkInterface(id, interfaceName),
    ),
    macAddressTable: [],
  }
}

function router(
  id: string,
  name: string,
  interfaceNames: string[],
): RouterNode {
  return {
    id,
    type: 'router',
    name,
    position: { x: 0, y: 0 },
    interfaces: interfaceNames.map((interfaceName) =>
      networkInterface(id, interfaceName),
    ),
    routingTable: [],
    arpCache: [],
  }
}

function networkInterface(
  nodeId: string,
  name: string,
  overrides: Partial<NetworkInterface> = {},
): NetworkInterface {
  return {
    id: interfaceId(nodeId, name),
    nodeId,
    name,
    macAddress: '02:00:00:00:00:01',
    connectedLinkIds: [],
    status: 'up',
    autoAssigned: true,
    manualOverride: false,
    ...overrides,
  }
}

function interfaceId(nodeId: string, name: string): InterfaceId {
  return `${nodeId}-${name.replaceAll('/', '-')}`
}

function endpoint(node: NetworkNode, interfaceName: string): LinkEndpoint {
  return {
    nodeId: node.id,
    interfaceId: interfaceId(node.id, interfaceName),
  }
}

function link(
  id: string,
  endpointA: LinkEndpoint,
  endpointB: LinkEndpoint,
): NetworkLink {
  return {
    id,
    endpointA,
    endpointB,
    status: 'up',
    delayMs: 100,
    lossRate: 0,
  }
}

function interfaceByName(
  topology: TopologyState,
  nodeId: string,
  name: string,
): NetworkInterface {
  const networkInterface = topology.nodes
    .find((node) => node.id === nodeId)
    ?.interfaces.find((iface) => iface.name === name)

  if (!networkInterface) {
    throw new Error(`Missing interface ${nodeId} ${name}`)
  }

  return networkInterface
}

function hostById(topology: TopologyState, nodeId: string): HostNode {
  const node = topology.nodes.find((candidate) => candidate.id === nodeId)

  if (!node || node.type !== 'host') {
    throw new Error(`Missing host ${nodeId}`)
  }

  return node
}
