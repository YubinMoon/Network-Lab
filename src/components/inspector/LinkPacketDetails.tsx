import type { ReactNode } from 'react'
import { packetOnLink, type LinkPacketSnapshot } from './linkPacketSnapshot'
import type {
  ArpMessage,
  EthernetFrame,
  IcmpMessage,
  IPv4Datagram,
  LinkEndpoint,
  NetworkLink,
  NetworkNode,
  RawPayload,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'

export function LinkPacketDetails({
  topology,
  link,
  nodes,
  currentEvent,
}: {
  topology: TopologyState
  link: NetworkLink
  nodes: NetworkNode[]
  currentEvent: SimulationEvent | undefined
}) {
  const packet = packetOnLink(topology, link, currentEvent)

  return (
    <section className="link-packet-details">
      <h3>Packet on Link</h3>
      {!packet ? (
        <p>No active packet on this Link.</p>
      ) : (
        <>
          <HeaderBlock
            title="Transit"
            fields={[
              ['Direction', directionLabel(link, packet.direction, nodes)],
              ['Current Event', packet.eventType],
              ['Packet ID', packet.packetId ?? '-'],
              ['Frame ID', packet.frame.id],
            ]}
          />
          <EthernetHeader frame={packet.frame} />
          {isArpMessage(packet.frame.payload) ? (
            <ArpHeader message={packet.frame.payload} />
          ) : null}
          {isIpv4Datagram(packet.frame.payload) ? (
            <Ipv4Header datagram={packet.frame.payload} />
          ) : null}
          {isIpv4Datagram(packet.frame.payload) &&
          isIcmpMessage(packet.frame.payload.payload) ? (
            <IcmpHeader message={packet.frame.payload.payload} />
          ) : null}
          {isIpv4Datagram(packet.frame.payload) &&
          isRawPayload(packet.frame.payload.payload) ? (
            <RawPayloadView payload={packet.frame.payload.payload} />
          ) : null}
        </>
      )}
    </section>
  )
}

function HeaderBlock({
  title,
  fields,
}: {
  title: string
  fields: Array<[string, ReactNode]>
}) {
  return (
    <div className="packet-header-block">
      <h4>{title}</h4>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function EthernetHeader({ frame }: { frame: EthernetFrame }) {
  return (
    <HeaderBlock
      title="Ethernet Header"
      fields={[
        ['Destination MAC', frame.dstMac],
        ['Source MAC', frame.srcMac],
        ['EtherType', `${frame.etherType} (${etherTypeValue(frame.etherType)})`],
        ['Header Length', '14 bytes'],
        ['Payload Length', `${ethernetPayloadLength(frame)} bytes`],
        ['Frame Check Sequence', 'not modeled'],
      ]}
    />
  )
}

function ArpHeader({ message }: { message: ArpMessage }) {
  return (
    <HeaderBlock
      title="ARP Header"
      fields={[
        ['Hardware Type', 'Ethernet (1)'],
        ['Protocol Type', 'IPv4 (0x0800)'],
        ['Hardware Address Length', '6 bytes'],
        ['Protocol Address Length', '4 bytes'],
        ['Operation', `${arpOperationLabel(message.operation)} (${arpOperationCode(message.operation)})`],
        ['Sender MAC', message.senderMac],
        ['Sender IP', message.senderIp],
        ['Target MAC', message.targetMac ?? '00:00:00:00:00:00 (unknown)'],
        ['Target IP', message.targetIp],
      ]}
    />
  )
}

function Ipv4Header({ datagram }: { datagram: IPv4Datagram }) {
  return (
    <HeaderBlock
      title="IPv4 Header"
      fields={[
        ['Version', '4'],
        ['Internet Header Length', '20 bytes (5 words)'],
        ['DSCP/ECN', '0 / 0'],
        ['Total Length', `${ipv4TotalLength(datagram)} bytes`],
        ['Identification', datagram.id],
        ['Flags', 'not modeled'],
        ['Fragment Offset', '0'],
        ['TTL', datagram.ttl],
        ['Protocol', ipv4ProtocolLabel(datagram)],
        ['Header Checksum', 'not modeled'],
        ['Source IP', datagram.srcIp],
        ['Destination IP', datagram.dstIp],
        ['Options', 'none'],
      ]}
    />
  )
}

function IcmpHeader({ message }: { message: IcmpMessage }) {
  return (
    <HeaderBlock
      title="ICMP Header"
      fields={[
        ['Type', `${icmpTypeLabel(message.type)} (${icmpTypeNumber(message.type)})`],
        ['Code', '0'],
        ['Checksum', 'not modeled'],
        ['Identifier', message.identifier ?? '-'],
        ['Sequence Number', message.sequenceNumber ?? '-'],
        ['Data Length', `${textByteLength(message.data ?? '')} bytes`],
        ['Data', <code className="packet-data">{message.data ?? ''}</code>],
      ]}
    />
  )
}

function RawPayloadView({ payload }: { payload: RawPayload }) {
  return (
    <HeaderBlock
      title="RAW Payload"
      fields={[
        ['Data Length', `${textByteLength(payload.data)} bytes`],
        ['Data', <code className="packet-data">{payload.data}</code>],
      ]}
    />
  )
}

function directionLabel(
  link: NetworkLink,
  direction: LinkPacketSnapshot['direction'],
  nodes: NetworkNode[],
): string {
  const from =
    direction === 'source-to-target' ? link.endpointA : link.endpointB
  const to = direction === 'source-to-target' ? link.endpointB : link.endpointA

  return `${endpointLabel(from, nodes)} -> ${endpointLabel(to, nodes)}`
}

function endpointLabel(endpoint: LinkEndpoint, nodes: NetworkNode[]): string {
  const node = nodes.find((candidate) => candidate.id === endpoint.nodeId)
  const networkInterface = node?.interfaces.find(
    (candidate) => candidate.id === endpoint.interfaceId,
  )

  return `${node?.name ?? endpoint.nodeId} ${networkInterface?.name ?? endpoint.interfaceId}`
}

function isArpMessage(value: unknown): value is ArpMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'operation' in value &&
    'senderIp' in value &&
    'senderMac' in value &&
    'targetIp' in value
  )
}

function isIpv4Datagram(value: unknown): value is IPv4Datagram {
  return (
    typeof value === 'object' &&
    value !== null &&
    'srcIp' in value &&
    'dstIp' in value &&
    'ttl' in value &&
    'protocol' in value &&
    'payload' in value
  )
}

function isIcmpMessage(value: unknown): value is IcmpMessage {
  return typeof value === 'object' && value !== null && 'type' in value
}

function isRawPayload(value: unknown): value is RawPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    !('type' in value)
  )
}

function etherTypeValue(etherType: EthernetFrame['etherType']): string {
  return etherType === 'ARP' ? '0x0806' : '0x0800'
}

function arpOperationLabel(operation: ArpMessage['operation']): string {
  return operation === 'request' ? 'Request' : 'Reply'
}

function arpOperationCode(operation: ArpMessage['operation']): number {
  return operation === 'request' ? 1 : 2
}

function ethernetPayloadLength(frame: EthernetFrame): number {
  if (isArpMessage(frame.payload)) {
    return 28
  }

  if (isIpv4Datagram(frame.payload)) {
    return ipv4TotalLength(frame.payload)
  }

  return 0
}

function ipv4TotalLength(datagram: IPv4Datagram): number {
  return 20 + upperLayerLength(datagram)
}

function upperLayerLength(datagram: IPv4Datagram): number {
  if (isIcmpMessage(datagram.payload)) {
    return 8 + textByteLength(datagram.payload.data ?? '')
  }

  if (isRawPayload(datagram.payload)) {
    return textByteLength(datagram.payload.data)
  }

  return 0
}

function ipv4ProtocolLabel(datagram: IPv4Datagram): string {
  return datagram.protocol === 'ICMP' ? 'ICMP (1)' : 'RAW (lab payload)'
}

function icmpTypeLabel(type: IcmpMessage['type']): string {
  if (type === 'echo-request') {
    return 'Echo Request'
  }

  if (type === 'echo-reply') {
    return 'Echo Reply'
  }

  if (type === 'time-exceeded') {
    return 'Time Exceeded'
  }

  return 'Destination Unreachable'
}

function icmpTypeNumber(type: IcmpMessage['type']): number {
  if (type === 'echo-request') {
    return 8
  }

  if (type === 'echo-reply') {
    return 0
  }

  if (type === 'time-exceeded') {
    return 11
  }

  return 3
}

function textByteLength(value: string): number {
  return value.length
}
