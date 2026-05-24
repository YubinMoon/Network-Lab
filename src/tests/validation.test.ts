import { describe, expect, test } from 'vitest'
import { simulateIpv4Packet } from '../domain/simulation'
import { validateTopology } from '../domain/validation'
import {
  DEFAULT_LAB_SETTINGS,
  type HostNode,
  type LinkEndpoint,
  type NetworkInterface,
  type NetworkLink,
  type SwitchNode,
  type TopologyState,
} from '../domain/types'

describe('Topology validation', () => {
  test('detects duplicate IP and MAC addresses', () => {
    const topology: TopologyState = {
      nodes: [
        hostNode('host-a', [
          networkInterface('host-a', 'eth0', {
            ipAddress: '10.0.1.10',
            macAddress: '02:00:00:00:00:01',
          }),
        ]),
        hostNode('host-b', [
          networkInterface('host-b', 'eth0', {
            ipAddress: '10.0.1.10',
            macAddress: '02:00:00:00:00:01',
          }),
        ]),
      ],
      links: [],
      segments: [],
      settings: DEFAULT_LAB_SETTINGS,
    }
    const issues = validateTopology(topology)

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-ip-address', 'duplicate-mac-address']),
    )
  })

  test('does not treat switch port MAC values as endpoint duplicates', () => {
    const topology: TopologyState = {
      nodes: [
        switchNode('switch-a', [
          networkInterface('switch-a', 'e0/1', {
            macAddress: '02:00:00:00:00:01',
          }),
        ]),
        switchNode('switch-b', [
          networkInterface('switch-b', 'e0/1', {
            macAddress: '02:00:00:00:00:01',
          }),
        ]),
      ],
      links: [],
      segments: [],
      settings: DEFAULT_LAB_SETTINGS,
    }

    expect(validateTopology(topology).map((issue) => issue.code)).not.toContain(
      'duplicate-mac-address',
    )
  })

  test('detects unsupported Layer 2 switch loops', () => {
    const switchA = switchNode('switch-a', [
      networkInterface('switch-a', 'e0/1'),
      networkInterface('switch-a', 'e0/2'),
    ])
    const switchB = switchNode('switch-b', [
      networkInterface('switch-b', 'e0/1'),
      networkInterface('switch-b', 'e0/2'),
    ])
    const topology: TopologyState = {
      nodes: [switchA, switchB],
      links: [
        link('link-1', endpoint('switch-a', 'e0/1'), endpoint('switch-b', 'e0/1')),
        link('link-2', endpoint('switch-a', 'e0/2'), endpoint('switch-b', 'e0/2')),
      ],
      segments: [],
      settings: DEFAULT_LAB_SETTINGS,
    }

    expect(validateTopology(topology)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported-l2-loop' }),
      ]),
    )
  })

  test('blocks packet simulation when unsupported L2 loop exists', () => {
    const topology: TopologyState = {
      nodes: [
        switchNode('switch-a', [
          networkInterface('switch-a', 'e0/1'),
          networkInterface('switch-a', 'e0/2'),
        ]),
        switchNode('switch-b', [
          networkInterface('switch-b', 'e0/1'),
          networkInterface('switch-b', 'e0/2'),
        ]),
      ],
      links: [
        link('link-1', endpoint('switch-a', 'e0/1'), endpoint('switch-b', 'e0/1')),
        link('link-2', endpoint('switch-a', 'e0/2'), endpoint('switch-b', 'e0/2')),
      ],
      segments: [],
      settings: DEFAULT_LAB_SETTINGS,
    }

    expect(
      simulateIpv4Packet(topology, {
        sourceHostId: 'host-a',
        destinationIp: '10.0.1.10',
        ttl: 64,
      }).result,
    ).toEqual({ status: 'dropped', reason: 'Unsupported L2 Loop' })
  })
})

function hostNode(id: string, interfaces: NetworkInterface[]): HostNode {
  return {
    id,
    type: 'host',
    name: id,
    position: { x: 0, y: 0 },
    interfaces,
    arpCache: [],
  }
}

function switchNode(id: string, interfaces: NetworkInterface[]): SwitchNode {
  return {
    id,
    type: 'switch',
    name: id,
    position: { x: 0, y: 0 },
    interfaces,
    macAddressTable: [],
  }
}

function networkInterface(
  nodeId: string,
  name: string,
  overrides: Partial<NetworkInterface> = {},
): NetworkInterface {
  return {
    id: `${nodeId}-${name.replaceAll('/', '-')}`,
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

function endpoint(nodeId: string, interfaceName: string): LinkEndpoint {
  return {
    nodeId,
    interfaceId: `${nodeId}-${interfaceName.replaceAll('/', '-')}`,
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
    mtu: 1500,
  }
}
