import { useLabStore } from '../../store/useLabStore'

export function PacketDetail() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const currentEvent = simulationTrace?.events[currentEventIndex]

  if (!simulationTrace || !currentEvent) {
    return <p className="empty-panel">No Packet Detail</p>
  }

  return (
    <div className="detail-grid">
      <dl>
        <div>
          <dt>Packet Type</dt>
          <dd>{simulationTrace.packetType}</dd>
        </div>
        <div>
          <dt>Packet ID</dt>
          <dd>{currentEvent.packetId ?? simulationTrace.packetId}</dd>
        </div>
        <div>
          <dt>Frame ID</dt>
          <dd>{currentEvent.frameId ?? '-'}</dd>
        </div>
        <div>
          <dt>Current Event</dt>
          <dd>{currentEvent.type}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>{simulationTrace.result.status}</dd>
        </div>
      </dl>
    </div>
  )
}
