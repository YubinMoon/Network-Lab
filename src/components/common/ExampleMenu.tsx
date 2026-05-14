import { useState } from 'react'
import { EXAMPLE_TOPOLOGIES } from '../../examples/topologies'
import { useLabStore } from '../../store/useLabStore'

export function ExampleMenu() {
  const loadExampleTopology = useLabStore((state) => state.loadExampleTopology)
  const [selectedExampleId, setSelectedExampleId] = useState(
    EXAMPLE_TOPOLOGIES[0].id,
  )
  const selectedExample =
    EXAMPLE_TOPOLOGIES.find((example) => example.id === selectedExampleId) ??
    EXAMPLE_TOPOLOGIES[0]

  return (
    <section className="example-menu" aria-label="Examples">
      <h2>Examples</h2>
      <select
        value={selectedExampleId}
        onChange={(event) => setSelectedExampleId(event.target.value)}
      >
        {EXAMPLE_TOPOLOGIES.map((example) => (
          <option key={example.id} value={example.id}>
            {example.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => loadExampleTopology(selectedExample)}
      >
        Load Example
      </button>
    </section>
  )
}
