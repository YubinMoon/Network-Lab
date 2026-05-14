import { describe, expect, test } from 'vitest'
import {
  applyArpReplyToCache,
  createArpRequestFrame,
  createReplyForArpRequest,
  findArpCacheEntry,
  selectHostArpTarget,
  updateArpCache,
} from '../domain/arp'
import { BROADCAST_MAC, type NetworkInterface } from '../domain/types'

describe('ARP simulation helpers', () => {
  test('selects destination IP as ARP target for same-subnet traffic', () => {
    expect(selectHostArpTarget('10.0.1.10', 24, '10.0.1.11')).toEqual({
      status: 'ok',
      targetIp: '10.0.1.11',
      reason: 'same-subnet',
    })
  })

  test('selects Default Gateway as ARP target for external traffic', () => {
    expect(
      selectHostArpTarget('10.0.1.10', 24, '10.0.2.10', '10.0.1.1'),
    ).toEqual({
      status: 'ok',
      targetIp: '10.0.1.1',
      reason: 'default-gateway',
    })
  })

  test('drops external traffic when no Default Gateway exists', () => {
    expect(selectHostArpTarget('10.0.1.10', 24, '10.0.2.10')).toEqual({
      status: 'drop',
      reason: 'No Default Gateway',
    })
  })

  test('creates ARP Request frames as broadcast Ethernet frames', () => {
    const request = createArpRequestFrame({
      frameId: 'frame-arp-request',
      senderIp: '10.0.1.10',
      senderMac: 'aa:aa:aa:aa:aa:01',
      targetIp: '10.0.1.1',
    })

    expect(request).toEqual(
      expect.objectContaining({
        dstMac: BROADCAST_MAC,
        srcMac: 'AA:AA:AA:AA:AA:01',
        etherType: 'ARP',
        payload: expect.objectContaining({
          operation: 'request',
          targetIp: '10.0.1.1',
        }),
      }),
    )
  })

  test('creates ARP Reply only for the matching target interface', () => {
    const request = createArpRequestFrame({
      frameId: 'frame-arp-request',
      senderIp: '10.0.1.10',
      senderMac: 'AA:AA:AA:AA:AA:01',
      targetIp: '10.0.1.1',
    })
    const reply = createReplyForArpRequest(
      request,
      networkInterface('r1-g0-0', '10.0.1.1', 'AA:AA:AA:AA:FF:01'),
      'frame-arp-reply',
    )

    expect(reply).toEqual(
      expect.objectContaining({
        dstMac: 'AA:AA:AA:AA:AA:01',
        srcMac: 'AA:AA:AA:AA:FF:01',
        etherType: 'ARP',
        payload: expect.objectContaining({
          operation: 'reply',
          senderIp: '10.0.1.1',
          targetIp: '10.0.1.10',
          targetMac: 'AA:AA:AA:AA:AA:01',
        }),
      }),
    )
    expect(
      createReplyForArpRequest(
        request,
        networkInterface('host-b-eth0', '10.0.1.11', 'AA:AA:AA:AA:AA:02'),
        'frame-no-reply',
      ),
    ).toBeUndefined()
  })

  test('updates ARP cache from ARP Reply sender fields', () => {
    const request = createArpRequestFrame({
      frameId: 'frame-arp-request',
      senderIp: '10.0.1.10',
      senderMac: 'AA:AA:AA:AA:AA:01',
      targetIp: '10.0.1.1',
    })
    const reply = createReplyForArpRequest(
      request,
      networkInterface('r1-g0-0', '10.0.1.1', 'AA:AA:AA:AA:FF:01'),
      'frame-arp-reply',
    )

    if (!reply) {
      throw new Error('Expected ARP Reply')
    }

    const cache = applyArpReplyToCache([], reply, 'host-a-eth0')

    expect(findArpCacheEntry(cache, '10.0.1.1')).toEqual(
      expect.objectContaining({
        macAddress: 'AA:AA:AA:AA:FF:01',
        interfaceId: 'host-a-eth0',
        source: 'dynamic',
      }),
    )
  })

  test('replaces existing ARP cache entries for the same IP', () => {
    const cache = updateArpCache(
      [
        {
          ipAddress: '10.0.1.1',
          macAddress: 'AA:AA:AA:AA:FF:00',
          interfaceId: 'host-a-eth0',
          ageSeconds: 20,
          source: 'dynamic',
        },
      ],
      {
        ipAddress: '10.0.1.1',
        macAddress: 'AA:AA:AA:AA:FF:01',
        interfaceId: 'host-a-eth0',
      },
    )

    expect(cache).toHaveLength(1)
    expect(cache[0].macAddress).toBe('AA:AA:AA:AA:FF:01')
    expect(cache[0].ageSeconds).toBe(0)
  })
})

function networkInterface(
  id: string,
  ipAddress: string,
  macAddress: string,
): NetworkInterface {
  return {
    id,
    nodeId: id.split('-')[0],
    name: id,
    macAddress,
    ipAddress,
    prefixLength: 24,
    connectedLinkIds: [],
    status: 'up',
    autoAssigned: true,
    manualOverride: false,
  }
}
