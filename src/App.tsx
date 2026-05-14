import '@xyflow/react/dist/style.css'
import './App.css'
import { NetworkCanvas } from './components/canvas/NetworkCanvas'
import { Inspector } from './components/inspector/Inspector'
import { useLabStore } from './store/useLabStore'
import type { NodeType } from './domain/types'

const paletteItems: Array<{ label: string; type: NodeType }> = [
  { label: 'Host', type: 'host' },
  { label: 'Switch', type: 'switch' },
  { label: 'Router', type: 'router' },
]
const simulationTabs = [
  'Timeline',
  'Event Log',
  'Layer View',
  'Packet Detail',
  'Binary Match',
]

function App() {
  const addNode = useLabStore((state) => state.addNode)
  const clearTopology = useLabStore((state) => state.clearTopology)
  const loadFirstMilestoneTopology = useLabStore(
    (state) => state.loadFirstMilestoneTopology,
  )
  const defaultTtl = useLabStore(
    (state) => state.topology.settings.defaultTtl,
  )

  return (
    <main className="lab-shell">
      <header className="top-bar">
        <h1>IPv4 Network Visualization Lab</h1>
        <nav aria-label="Primary">
          <button type="button">Lab</button>
          <button type="button">Examples</button>
          <button type="button">Packet Trace</button>
          <button type="button">Settings</button>
          <button type="button">Share</button>
        </nav>
      </header>

      <section className="workspace" aria-label="Lab Workspace">
        <aside className="palette" aria-label="Palette">
          <h2>Palette</h2>
          <div className="tool-list">
            {paletteItems.map((item) => (
              <button
                type="button"
                key={item.type}
                onClick={() => addNode(item.type)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="topology-actions">
            <button type="button" onClick={loadFirstMilestoneTopology}>
              Load First Milestone
            </button>
            <button type="button" onClick={clearTopology}>
              Clear
            </button>
          </div>
          <div className="packet-tool">
            <h2>Packet Generator</h2>
            <dl>
              <div>
                <dt>Packet Type</dt>
                <dd>ICMP Echo Request</dd>
              </div>
              <div>
                <dt>TTL</dt>
                <dd>{defaultTtl}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <section className="canvas" aria-label="Network Canvas">
          <div className="canvas-toolbar">
            <span>Network Segment</span>
            <span>Auto Configuration: On</span>
          </div>
          <NetworkCanvas />
        </section>

        <Inspector />
      </section>

      <section className="simulation-panel" aria-label="Simulation Panel">
        <div className="simulation-controls" aria-label="Simulation Controls">
          <button type="button">Play</button>
          <button type="button">Pause</button>
          <button type="button">Next Event</button>
          <button type="button">Reset</button>
          <span>Speed: 1x</span>
        </div>
        <div className="simulation-tabs">
          {simulationTabs.map((tab) => (
            <button type="button" key={tab}>
              {tab}
            </button>
          ))}
        </div>
        <ol className="event-log" aria-label="Event Log">
          <li>Simulation idle.</li>
        </ol>
      </section>
    </main>
  )
}

export default App
