import { EventLog } from './EventLog'
import { useLabStore } from '../../store/useLabStore'

export function SimulationPanel() {
  const clearSimulationTrace = useLabStore((state) => state.clearSimulationTrace)

  return (
    <section className="simulation-panel" aria-label="Simulation Panel">
      <div className="simulation-panel-header">
        <h2>Event Log</h2>
        <button
          type="button"
          className="simulation-clear-button"
          onClick={clearSimulationTrace}
        >
          Clear Log
        </button>
      </div>
      <div className="simulation-panel-content">
        <EventLog />
      </div>
    </section>
  )
}
