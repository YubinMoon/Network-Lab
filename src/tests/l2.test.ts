import { describe, expect, test } from 'vitest'
import { learnSourceMac, processSwitchFrame } from '../domain/l2'
import {
  BROADCAST_MAC,
  type EthernetFrame,
  type NetworkInterface,
  type SwitchNode,
} from '../domain/types'

describe('Layer 2 switching', () => {
  test('learns source MAC on the ingress port', () => {
    const table = learnSourceMac(
      [{ macAddress: 'AA:AA:AA:AA:AA:01', portInterfaceId: 's1-e0-3', ageSeconds: 30 }],
      'aa:aa:aa:aa:aa:01',
      's1-e0-1',
    )

    expect(table).toEqual([
      {
        macAddress: 'AA:AA:AA:AA:AA:01',
        portInterfaceId: 's1-e0-1',
        ageSeconds: 0,
      },
    ])
  })

  test('floods broadcast frames to all ports except ingress', () => {
    const decision = processSwitchFrame(
      switchS1(),
      's1-e0-1',
      frame('AA:AA:AA:AA:AA:01', BROADCAST_MAC),
    )

    expect(decision.kind).toBe('broadcast-flooded')
    expect(decision.egressInterfaceIds).toEqual(['s1-e0-2', 's1-e0-3'])
    expect(decision.learnedEntry).toEqual(
      expect.objectContaining({
        macAddress: 'AA:AA:AA:AA:AA:01',
        portInterfaceId: 's1-e0-1',
      }),
    )
  })

  test('forwards known unicast frames only to the learned port', () => {
    const decision = processSwitchFrame(
      {
        ...switchS1(),
        macAddressTable: [
          {
            macAddress: 'AA:AA:AA:AA:AA:02',
            portInterfaceId: 's1-e0-2',
            ageSeconds: 0,
          },
        ],
      },
      's1-e0-1',
      frame('AA:AA:AA:AA:AA:01', 'AA:AA:AA:AA:AA:02'),
    )

    expect(decision.kind).toBe('known-unicast-forwarded')
    expect(decision.egressInterfaceIds).toEqual(['s1-e0-2'])
  })

  test('floods unknown unicast frames to all ports except ingress', () => {
    const decision = processSwitchFrame(
      switchS1(),
      's1-e0-1',
      frame('AA:AA:AA:AA:AA:01', 'AA:AA:AA:AA:AA:99'),
    )

    expect(decision.kind).toBe('unknown-unicast-flooded')
    expect(decision.egressInterfaceIds).toEqual(['s1-e0-2', 's1-e0-3'])
  })
})

function switchS1(): SwitchNode {
  return {
    id: 'switch-s1',
    type: 'switch',
    name: 'Switch S1',
    position: { x: 0, y: 0 },
    interfaces: ['e0/1', 'e0/2', 'e0/3'].map((name) =>
      switchInterface(`s1-${name.replaceAll('/', '-')}`, name),
    ),
    macAddressTable: [],
  }
}

function switchInterface(id: string, name: string): NetworkInterface {
  return {
    id,
    nodeId: 'switch-s1',
    name,
    macAddress: '02:00:00:00:00:01',
    connectedLinkIds: [],
    status: 'up',
    autoAssigned: true,
    manualOverride: false,
  }
}

function frame(srcMac: string, dstMac: string): EthernetFrame {
  return {
    id: 'frame-1',
    srcMac,
    dstMac,
    etherType: 'ARP',
    payload: {
      operation: 'request',
      senderIp: '10.0.1.10',
      senderMac: srcMac,
      targetIp: '10.0.1.1',
    },
  }
}
