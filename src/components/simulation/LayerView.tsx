import type { EthernetFrame, IPv4Datagram } from '../../domain/types'
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
          <dt>Protocol</dt>
          <dd>{datagram?.protocol ?? '-'}</dd>
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
