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

  return (
    <section
      className={collapsed ? 'simulation-panel collapsed' : 'simulation-panel'}
      aria-label="Simulation Panel"
    >
      <div className="simulation-panel-header">
        <h2>Packet Trace</h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((nextCollapsed) => !nextCollapsed)}
        >
          {collapsed ? 'Expand Event Log' : 'Minimize Event Log'}
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
