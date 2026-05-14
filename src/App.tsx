import './App.css'

const paletteItems = ['Host', 'Switch', 'Router', 'Link']
const topologyNodes = ['Host A', 'Switch S1', 'Router R1', 'Switch S2', 'Host B']
const simulationTabs = [
  'Timeline',
  'Event Log',
  'Layer View',
  'Packet Detail',
  'Binary Match',
]

function App() {
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
              <button type="button" key={item}>
                {item}
              </button>
            ))}
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
                <dd>64</dd>
              </div>
            </dl>
          </div>
        </aside>

        <section className="canvas" aria-label="Network Canvas">
          <div className="canvas-toolbar">
            <span>Network Segment</span>
            <span>Auto Configuration: On</span>
          </div>
          <div className="topology-preview" aria-label="First Milestone Topology">
            {topologyNodes.map((node, index) => (
              <div className="topology-step" key={node}>
                <div className={`node ${node.split(' ')[0].toLowerCase()}`}>
                  {node}
                </div>
                {index < topologyNodes.length - 1 ? (
                  <div className="link" aria-label="Link" />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="inspector" aria-label="Inspector">
          <h2>Inspector</h2>
          <section>
            <h3>Selection</h3>
            <p>Router R1</p>
          </section>
          <section>
            <h3>Routing Table</h3>
            <table>
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Prefix</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>10.0.1.0</td>
                  <td>/24</td>
                  <td>Connected</td>
                </tr>
                <tr>
                  <td>10.0.2.0</td>
                  <td>/24</td>
                  <td>Connected</td>
                </tr>
              </tbody>
            </table>
          </section>
        </aside>
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
          <li>Host A ARP Cache miss for 10.0.1.1.</li>
          <li>Switch S1 learned source MAC on ingress port.</li>
          <li>Router R1 selected route by Longest Prefix Match.</li>
        </ol>
      </section>
    </main>
  )
}

export default App
