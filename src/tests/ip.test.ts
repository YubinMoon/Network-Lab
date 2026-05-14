import { describe, expect, test } from 'vitest'
import {
  broadcastAddress,
  formatIpv4,
  hostAddressFromOffset,
  ipMatchesPrefix,
  isValidIpv4,
  isValidPrefixLength,
  networkAddress,
  parseIpv4,
  toBinaryIpv4,
  toBinaryPrefixPattern,
} from '../domain/ip'
import {
  generateMac,
  isBroadcastMac,
  isValidMac,
  normalizeMac,
} from '../domain/mac'

describe('IPv4 utilities', () => {
  test('parses and formats IPv4 addresses', () => {
    expect(formatIpv4(parseIpv4('10.0.1.10'))).toBe('10.0.1.10')
  })

  test('calculates /24 network and broadcast addresses', () => {
    expect(networkAddress('10.0.1.10', 24)).toBe('10.0.1.0')
    expect(broadcastAddress('10.0.1.10', 24)).toBe('10.0.1.255')
  })

  test('calculates /30 network and broadcast addresses', () => {
    expect(networkAddress('10.255.1.2', 30)).toBe('10.255.1.0')
    expect(broadcastAddress('10.255.1.2', 30)).toBe('10.255.1.3')
  })

  test('matches addresses by prefix', () => {
    expect(ipMatchesPrefix('10.0.2.10', '10.0.2.0', 24)).toBe(true)
    expect(ipMatchesPrefix('10.0.2.10', '10.0.1.0', 24)).toBe(false)
  })

  test('formats binary IPv4 addresses and prefix patterns', () => {
    expect(toBinaryIpv4('10.0.2.10')).toBe(
      '00001010.00000000.00000010.00001010',
    )
    expect(toBinaryPrefixPattern('10.0.2.0', 24)).toBe(
      '00001010.00000000.00000010.xxxxxxxx',
    )
  })

  test('rejects invalid IPv4 inputs and prefix lengths', () => {
    expect(isValidIpv4('10.0.1.10')).toBe(true)
    expect(isValidIpv4('10.0.1.999')).toBe(false)
    expect(() => parseIpv4('10.0.1')).toThrow('Invalid IPv4 address')
    expect(isValidPrefixLength(24)).toBe(true)
    expect(isValidPrefixLength(33)).toBe(false)
  })

  test('creates host addresses from a subnet offset', () => {
    expect(hostAddressFromOffset('10.0.1.0', 24, 10)).toBe('10.0.1.10')
    expect(hostAddressFromOffset('10.255.1.0', 30, 2)).toBe('10.255.1.2')
  })
})

describe('MAC utilities', () => {
  test('validates and normalizes MAC addresses', () => {
    expect(isValidMac('aa:bb:cc:dd:ee:ff')).toBe(true)
    expect(isValidMac('aa-bb-cc-dd-ee-ff')).toBe(true)
    expect(isValidMac('aa:bb:cc:dd:ee')).toBe(false)
    expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF')
  })

  test('generates deterministic locally administered MAC addresses from a seed', () => {
    expect(generateMac('host-a')).toBe(generateMac('host-a'))
    expect(generateMac('host-a')).toMatch(/^02:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
  })

  test('detects broadcast MAC addresses', () => {
    expect(isBroadcastMac('ff:ff:ff:ff:ff:ff')).toBe(true)
  })
})
