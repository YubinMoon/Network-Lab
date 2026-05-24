import { describe, expect, test } from 'vitest'
import {
  fragmentIpv4Datagram,
  ipv4HeaderChecksum,
  ipv4TotalLength,
} from '../domain/fragmentation'
import { createIpv4Datagram } from '../domain/ipv4'

describe('IPv4 fragmentation', () => {
  test('splits a datagram into MTU-sized fragments with offsets and MF flags', () => {
    const datagram = createIpv4Datagram({
      id: 'packet-1',
      srcIp: '10.0.1.10',
      dstIp: '10.0.2.10',
      ttl: 64,
      protocol: 'RAW',
      payload: { data: 'x'.repeat(120) },
    })
    const result = fragmentIpv4Datagram(datagram, 68)

    expect(result.status).toBe('fragmented')
    expect(
      result.datagrams.map((fragment) => fragment.fragmentPayloadLength),
    ).toEqual([48, 48, 24])
    expect(result.datagrams.map((fragment) => fragment.fragmentOffset)).toEqual(
      [0, 6, 12],
    )
    expect(result.datagrams.map((fragment) => fragment.moreFragments)).toEqual([
      true,
      true,
      false,
    ])
    expect(
      result.datagrams.every((fragment) => ipv4TotalLength(fragment) <= 68),
    ).toBe(true)
  })

  test('drops when DF is set and the datagram exceeds MTU', () => {
    const datagram = createIpv4Datagram({
      id: 'packet-1',
      srcIp: '10.0.1.10',
      dstIp: '10.0.2.10',
      ttl: 64,
      protocol: 'RAW',
      payload: { data: 'x'.repeat(120) },
    })
    const result = fragmentIpv4Datagram({ ...datagram, dontFragment: true }, 68)

    expect(result).toEqual(
      expect.objectContaining({
        status: 'dropped',
        reason: 'Fragmentation Needed',
      }),
    )
  })

  test('computes a concrete IPv4 header checksum value', () => {
    const datagram = createIpv4Datagram({
      id: 'packet-1',
      srcIp: '10.0.1.10',
      dstIp: '10.0.2.10',
      ttl: 64,
      protocol: 'RAW',
      payload: { data: 'hello' },
    })

    expect(ipv4HeaderChecksum(datagram)).toMatch(/^0x[0-9A-F]{4}$/)
  })
})
