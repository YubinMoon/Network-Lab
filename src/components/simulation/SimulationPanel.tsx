import { useState } from 'react'
import { BinaryMatchView } from './BinaryMatchView'
import { EventLog } from './EventLog'
import { LayerView } from './LayerView'
import { PacketDetail } from './PacketDetail'
import { SimulationControls } from './SimulationControls'
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

  return (
    <section className="simulation-panel" aria-label="Simulation Panel">
      <SimulationControls />
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
    </section>
  )
}
