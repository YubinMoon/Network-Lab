import { useLabStore } from '../../store/useLabStore'

export function Timeline() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)

  if (!simulationTrace) {
    return <p className="empty-panel">No Timeline</p>
  }

  return (
    <div className="timeline" aria-label="Timeline">
      {simulationTrace.events.map((event, index) => (
        <span
          className={index === currentEventIndex ? 'timeline-dot active' : 'timeline-dot'}
          key={event.id}
          title={event.description}
        />
      ))}
    </div>
  )
}
