import { useLabStore } from '../../store/useLabStore'

export function EventLog() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)

  return (
    <ol className="event-log" aria-label="Event Log">
      {simulationTrace ? (
        simulationTrace.events.map((event, index) => (
          <li
            className={index === currentEventIndex ? 'active-event' : undefined}
            key={event.id}
          >
            {event.description}
          </li>
        ))
      ) : (
        <li>Simulation idle.</li>
      )}
    </ol>
  )
}
