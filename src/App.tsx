import { useEffect } from 'react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { ExampleMenu } from './components/common/ExampleMenu'
import { PersistenceControls } from './components/common/PersistenceControls'
import { NetworkCanvas } from './components/canvas/NetworkCanvas'
import { Inspector } from './components/inspector/Inspector'
import { PacketGenerator } from './components/simulation/PacketGenerator'
import { SimulationControls } from './components/simulation/SimulationControls'
import { SimulationPanel } from './components/simulation/SimulationPanel'
import { useLabStore } from './store/useLabStore'
import type { NodeType } from './domain/types'

const paletteItems: Array<{ label: string; type: NodeType }> = [
  { label: 'Host', type: 'host' },
  { label: 'Switch', type: 'switch' },
  { label: 'Router', type: 'router' },
]
function App() {
  const addNode = useLabStore((state) => state.addNode)
  const clearTopology = useLabStore((state) => state.clearTopology)
  const loadTopologyFromHash = useLabStore((state) => state.loadTopologyFromHash)
  const segmentCount = useLabStore((state) => state.topology.segments.length)

  useEffect(() => {
    loadTopologyFromHash(window.location.hash)
  }, [loadTopologyFromHash])

  return (
    <main className="lab-shell">
      <header className="top-bar">
        <h1>IPv4 Network Visualization Lab</h1>
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
            <button
              type="button"
              className="clear-topology-button"
              onClick={clearTopology}
            >
              Clear
            </button>
          </div>
          <ExampleMenu />
          <SimulationControls />
          <PacketGenerator />
          <PersistenceControls />
        </aside>

        <section className="canvas" aria-label="Network Canvas">
          <div className="canvas-toolbar">
            <span>Network Segment: {segmentCount}</span>
            <span>Auto Configuration: On</span>
          </div>
          <NetworkCanvas />
        </section>

        <SimulationPanel />
        <Inspector />
      </section>
    </main>
  )
}

export default App
