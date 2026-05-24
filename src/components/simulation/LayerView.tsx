import type { EthernetFrame, IPv4Datagram } from '../../domain/types'
import {
  ipv4FlagsValue,
  ipv4HeaderChecksum,
  ipv4IdentificationValue,
  ipv4TotalLength,
} from '../../domain/fragmentation'
import { useLabStore } from '../../store/useLabStore'

export function LayerView() {
  const currentEvent = useCurrentEvent()
  const frame = currentEvent?.details?.ethernetFrame as EthernetFrame | undefined
  const datagram =
    (currentEvent?.details?.datagram as IPv4Datagram | undefined) ??
    (frame?.etherType === 'IPv4' ? (frame.payload as IPv4Datagram) : undefined)

  if (!currentEvent) {
    return <p className="empty-panel">No Layer View</p>
  }

  return (
    <div className="detail-grid">
      <h3>Ethernet Frame</h3>
      <dl>
        <div>
          <dt>Source MAC</dt>
          <dd>{frame?.srcMac ?? '-'}</dd>
        </div>
        <div>
          <dt>Destination MAC</dt>
          <dd>{frame?.dstMac ?? '-'}</dd>
        </div>
        <div>
          <dt>EtherType</dt>
          <dd>{frame?.etherType ?? '-'}</dd>
        </div>
      </dl>
      <h3>IPv4 Datagram</h3>
      <dl>
        <div>
          <dt>Source IP</dt>
          <dd>{datagram?.srcIp ?? '-'}</dd>
        </div>
        <div>
          <dt>Destination IP</dt>
          <dd>{datagram?.dstIp ?? '-'}</dd>
        </div>
        <div>
          <dt>TTL</dt>
          <dd>{datagram?.ttl ?? '-'}</dd>
        </div>
        <div>
          <dt>Total Length</dt>
          <dd>{datagram ? `${ipv4TotalLength(datagram)} bytes` : '-'}</dd>
        </div>
        <div>
          <dt>Identification</dt>
          <dd>{datagram ? ipv4IdentificationLabel(datagram) : '-'}</dd>
        </div>
        <div>
          <dt>Flags</dt>
          <dd>{datagram ? ipv4FlagsLabel(datagram) : '-'}</dd>
        </div>
        <div>
          <dt>Fragment Offset</dt>
          <dd>{datagram ? datagram.fragmentOffset : '-'}</dd>
        </div>
        <div>
          <dt>Protocol</dt>
          <dd>{datagram?.protocol ?? '-'}</dd>
        </div>
        <div>
          <dt>Header Checksum</dt>
          <dd>{datagram ? ipv4HeaderChecksum(datagram) : '-'}</dd>
        </div>
      </dl>
    </div>
  )
}

function useCurrentEvent() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)

  return simulationTrace?.events[currentEventIndex]
}

function ipv4FlagsLabel(datagram: IPv4Datagram): string {
  const value = ipv4FlagsValue(datagram)

  return `DF=${datagram.dontFragment ? 1 : 0}, MF=${datagram.moreFragments ? 1 : 0} (0x${value.toString(16).padStart(4, '0').toUpperCase()})`
}

function ipv4IdentificationLabel(datagram: IPv4Datagram): string {
  const value = ipv4IdentificationValue(datagram)

  return `${value} (0x${value.toString(16).padStart(4, '0').toUpperCase()})`
}
