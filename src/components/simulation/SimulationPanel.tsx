import { EventLog } from './EventLog'

export function SimulationPanel() {
  return (
    <section className="simulation-panel" aria-label="Simulation Panel">
      <div className="simulation-panel-header">
        <h2>Event Log</h2>
      </div>
      <div className="simulation-panel-content">
        <EventLog />
      </div>
    </section>
  )
}
