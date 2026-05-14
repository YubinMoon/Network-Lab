import { useState } from 'react'
import { BinaryMatchView } from './BinaryMatchView'
import { EventLog } from './EventLog'
import { LayerView } from './LayerView'
import { PacketDetail } from './PacketDetail'
import { Timeline } from './Timeline'

type SimulationTab =
  | 'Timeline'
  | 'Event Log'
  | 'Layer View'
  | 'Packet Detail'
  | 'Binary Match'

const tabs: SimulationTab[] = [
  'Timeline',
  'Event Log',
  'Layer View',
  'Packet Detail',
  'Binary Match',
]

export function SimulationPanel() {
  const [activeTab, setActiveTab] = useState<SimulationTab>('Event Log')
  const [collapsed, setCollapsed] = useState(false)
  const toggleLabel = collapsed ? 'Expand Event Log' : 'Minimize Event Log'

  return (
    <section
      className={collapsed ? 'simulation-panel collapsed' : 'simulation-panel'}
      aria-label="Simulation Panel"
    >
      <div className="simulation-panel-header">
        <h2>Packet Trace</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((nextCollapsed) => !nextCollapsed)}
        >
          <svg
            className="panel-toggle-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d={collapsed ? 'M6 15L12 9L18 15' : 'M6 9L12 15L18 9'} />
          </svg>
        </button>
      </div>
      {!collapsed ? (
        <div className="simulation-panel-content">
          <div className="simulation-tabs">
            {tabs.map((tab) => (
              <button
                className={tab === activeTab ? 'active-tab' : undefined}
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === 'Timeline' ? <Timeline /> : null}
          {activeTab === 'Event Log' ? <EventLog /> : null}
          {activeTab === 'Layer View' ? <LayerView /> : null}
          {activeTab === 'Packet Detail' ? <PacketDetail /> : null}
          {activeTab === 'Binary Match' ? <BinaryMatchView /> : null}
        </div>
      ) : null}
    </section>
  )
}
