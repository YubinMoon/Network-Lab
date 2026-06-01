import { describe, expect, test } from 'vitest'
import {
  LINK_PACKET_COLORS,
  linkPacketKindForEvent,
  linkPacketKindForFrame,
} from '../components/canvas/packetVisuals'
import type { EthernetFrame, SimulationEvent } from '../domain/types'

describe('packet visual classification', () => {
  test('classifies ARP frames as ARP packet movement', () => {
    expect(linkPacketKindForFrame(arpFrame())).toBe('arp')
  })

  test('classifies IPv4 ICMP frames as ICMP packet movement', () => {
    expect(linkPacketKindForFrame(icmpFrame())).toBe('icmp')
  })

  test('classifies IPv4 RAW frames as generic IPv4 packet movement', () => {
    expect(linkPacketKindForFrame(rawFrame())).toBe('generic-ipv4')
  })

  test('falls back to generic IPv4 packet movement when frame details are missing', () => {
    expect(linkPacketKindForEvent(eventWithoutFrame())).toBe('generic-ipv4')
  })

  test('keeps packet movement colors readable against the canvas grid', () => {
    const canvasBackground = '#111820'
    const canvasGrid = '#26323d'

    for (const color of Object.values(LINK_PACKET_COLORS)) {
      expect(contrastRatio(color, canvasBackground)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(color, canvasGrid)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

function arpFrame(): EthernetFrame {
  return {
    id: 'frame-arp',
    srcMac: '02:00:00:00:00:0A',
    dstMac: 'FF:FF:FF:FF:FF:FF',
    etherType: 'ARP',
    payload: {
      operation: 'request',
      senderIp: '10.0.1.10',
      senderMac: '02:00:00:00:00:0A',
      targetIp: '10.0.1.11',
    },
  }
}

function icmpFrame(): EthernetFrame {
  return {
    id: 'frame-icmp',
    srcMac: '02:00:00:00:00:0A',
    dstMac: '02:00:00:00:00:0B',
    etherType: 'IPv4',
    payload: {
      id: 'packet-icmp',
      identification: '0x0001',
      srcIp: '10.0.1.10',
      dstIp: '10.0.1.11',
      ttl: 64,
      protocol: 'ICMP',
      dontFragment: false,
      moreFragments: false,
      fragmentOffset: 0,
      payload: {
        type: 'echo-reply',
        identifier: 1,
        sequenceNumber: 1,
        data: 'Hello',
      },
    },
  }
}

function rawFrame(): EthernetFrame {
  return {
    id: 'frame-raw',
    srcMac: '02:00:00:00:00:0A',
    dstMac: '02:00:00:00:00:0B',
    etherType: 'IPv4',
    payload: {
      id: 'packet-raw',
      identification: '0x0002',
      srcIp: '10.0.1.10',
      dstIp: '10.0.1.11',
      ttl: 64,
      protocol: 'RAW',
      dontFragment: false,
      moreFragments: false,
      fragmentOffset: 0,
      payload: {
        data: 'Hello',
      },
    },
  }
}

function eventWithoutFrame(): SimulationEvent {
  return {
    id: 'event-1',
    timeMs: 0,
    type: 'packet-forwarded',
    actorNodeId: 'router-r1',
    packetId: 'packet-1',
    description: 'Router R1 forwarded IPv4 Datagram.',
    visualAction: { type: 'none' },
    details: {
      outInterfaceId: 'router-r1-g0-0',
    },
  }
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(hexColor: string): number {
  const [red, green, blue] = hexToRgb(hexColor).map((channel) => {
    const normalized = channel / 255

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function hexToRgb(hexColor: string): [number, number, number] {
  const red = Number.parseInt(hexColor.slice(1, 3), 16)
  const green = Number.parseInt(hexColor.slice(3, 5), 16)
  const blue = Number.parseInt(hexColor.slice(5, 7), 16)

  return [red, green, blue]
}
