import { ipMatchesPrefix, isValidIpv4, isValidPrefixLength } from './ip'
import { isValidMac } from './mac'
import type {
  InterfaceId,
  LinkId,
  NetworkNode,
  TopologyState,
  ValidationIssue,
} from './types'

export type FieldValidationResult =
  | { valid: true }
  | { valid: false; message: string }

export function validateIpv4Address(ip: string): FieldValidationResult {
  return isValidIpv4(ip)
    ? { valid: true }
    : { valid: false, message: 'Invalid IP Configuration' }
}

export function validatePrefixLength(prefix: number): FieldValidationResult {
  return isValidPrefixLength(prefix)
    ? { valid: true }
    : { valid: false, message: 'Invalid IP Configuration' }
}

export function validateMacAddress(mac: string): FieldValidationResult {
  return isValidMac(mac)
    ? { valid: true }
    : { valid: false, message: 'Invalid MAC Address' }
}

export function validateTopology(topology: TopologyState): ValidationIssue[] {
  return [
    ...validateInterfaces(topology),
    ...validateDuplicateIpAddresses(topology),
    ...validateDuplicateMacAddresses(topology),
    ...validateLinkAndInterfaceState(topology),
    ...validateUnsupportedL2Loop(topology),
  ]
}

function validateInterfaces(topology: TopologyState): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      if (networkInterface.ipAddress && !isValidIpv4(networkInterface.ipAddress)) {
        issues.push({
          id: `invalid-ip-${networkInterface.id}`,
          severity: 'error',
          code: 'invalid-ip-address',
          message: 'Invalid IP Configuration',
          relatedNodeIds: [node.id],
          relatedInterfaceIds: [networkInterface.id],
        })
      }

      if (
        networkInterface.prefixLength !== undefined &&
        !isValidPrefixLength(networkInterface.prefixLength)
      ) {
        issues.push({
          id: `invalid-prefix-${networkInterface.id}`,
          severity: 'error',
          code: 'invalid-prefix-length',
          message: 'Invalid IP Configuration',
          relatedNodeIds: [node.id],
          relatedInterfaceIds: [networkInterface.id],
        })
      }

      if (!isValidMac(networkInterface.macAddress)) {
        issues.push({
          id: `invalid-mac-${networkInterface.id}`,
          severity: 'error',
          code: 'duplicate-mac-address',
          message: 'Invalid MAC Address',
          relatedNodeIds: [node.id],
          relatedInterfaceIds: [networkInterface.id],
        })
      }
    }

    if (node.type === 'host' && node.defaultGatewayIp) {
      const hostInterface = node.interfaces[0]

      if (
        hostInterface?.ipAddress &&
        hostInterface.prefixLength !== undefined &&
        !sameSubnet(
          hostInterface.ipAddress,
          node.defaultGatewayIp,
          hostInterface.prefixLength,
        )
      ) {
        issues.push({
          id: `gateway-outside-subnet-${node.id}`,
          severity: 'error',
          code: 'gateway-outside-subnet',
          message: 'Default Gateway is outside the host subnet.',
          relatedNodeIds: [node.id],
          relatedInterfaceIds: [hostInterface.id],
        })
      }
    }
  }

  return issues
}

function validateDuplicateIpAddresses(topology: TopologyState): ValidationIssue[] {
  return duplicateInterfaceValueIssues(
    topology,
    (networkInterface) => networkInterface.ipAddress,
    'duplicate-ip-address',
    'Duplicate IP Address',
  )
}

function validateDuplicateMacAddresses(topology: TopologyState): ValidationIssue[] {
  return duplicateInterfaceValueIssues(
    topology,
    (networkInterface) => networkInterface.macAddress.toUpperCase(),
    'duplicate-mac-address',
    'Duplicate MAC Address',
  )
}

function validateLinkAndInterfaceState(topology: TopologyState): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      if (networkInterface.status === 'down') {
        issues.push({
          id: `interface-down-${networkInterface.id}`,
          severity: 'warning',
          code: 'interface-down',
          message: 'Interface Down',
          relatedNodeIds: [node.id],
          relatedInterfaceIds: [networkInterface.id],
        })
      }
    }
  }

  for (const link of topology.links) {
    if (link.status === 'down') {
      issues.push({
        id: `link-down-${link.id}`,
        severity: 'warning',
        code: 'link-down',
        message: 'Link Down',
        relatedLinkIds: [link.id],
      })
    }
  }

  return issues
}

function validateUnsupportedL2Loop(topology: TopologyState): ValidationIssue[] {
  const loopLinkIds = unsupportedSwitchLoopLinkIds(topology)

  if (loopLinkIds.length === 0) {
    return []
  }

  return [
    {
      id: 'unsupported-l2-loop',
      severity: 'error',
      code: 'unsupported-l2-loop',
      message:
        'Unsupported L2 Loop Detected. This topology creates a Layer 2 loop. STP is not supported in this lab.',
      relatedLinkIds: loopLinkIds,
    },
  ]
}

function duplicateInterfaceValueIssues(
  topology: TopologyState,
  valueFor: (networkInterface: NetworkNode['interfaces'][number]) => string | undefined,
  code: ValidationIssue['code'],
  message: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Map<string, { nodeId: string; interfaceId: InterfaceId }>()

  for (const node of topology.nodes) {
    for (const networkInterface of node.interfaces) {
      const value = valueFor(networkInterface)

      if (!value) {
        continue
      }

      const existing = seen.get(value)

      if (existing) {
        issues.push({
          id: `${code}-${value}`,
          severity: 'error',
          code,
          message,
          relatedNodeIds: [existing.nodeId, node.id],
          relatedInterfaceIds: [existing.interfaceId, networkInterface.id],
        })
      } else {
        seen.set(value, {
          nodeId: node.id,
          interfaceId: networkInterface.id,
        })
      }
    }
  }

  return issues
}

function unsupportedSwitchLoopLinkIds(topology: TopologyState): LinkId[] {
  const switchIds = new Set(
    topology.nodes
      .filter((node) => node.type === 'switch')
      .map((node) => node.id),
  )
  const adjacency = new Map<string, Array<{ to: string; linkId: LinkId }>>()

  for (const networkLink of topology.links) {
    const a = networkLink.endpointA.nodeId
    const b = networkLink.endpointB.nodeId

    if (!switchIds.has(a) || !switchIds.has(b) || networkLink.status === 'down') {
      continue
    }

    adjacency.set(a, [...(adjacency.get(a) ?? []), { to: b, linkId: networkLink.id }])
    adjacency.set(b, [...(adjacency.get(b) ?? []), { to: a, linkId: networkLink.id }])
  }

  const visited = new Set<string>()
  const loopLinkIds: LinkId[] = []

  for (const switchId of adjacency.keys()) {
    if (visited.has(switchId)) {
      continue
    }

    const componentSwitches = new Set<string>()
    const componentLinks = new Set<LinkId>()
    const stack = [switchId]
    visited.add(switchId)

    while (stack.length > 0) {
      const current = stack.pop()

      if (!current) {
        continue
      }

      componentSwitches.add(current)

      for (const edge of adjacency.get(current) ?? []) {
        componentLinks.add(edge.linkId)

        if (!visited.has(edge.to)) {
          visited.add(edge.to)
          stack.push(edge.to)
        }
      }
    }

    if (componentLinks.size >= componentSwitches.size) {
      loopLinkIds.push(...componentLinks)
    }
  }

  return loopLinkIds
}

function sameSubnet(a: string, b: string, prefixLength: number): boolean {
  return ipMatchesPrefix(b, a, prefixLength)
}
