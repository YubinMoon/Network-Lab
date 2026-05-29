import { useEffect } from 'react'
import { useLabStore } from '../../store/useLabStore'

const speeds = [0.5, 1, 2, 4]

export function SimulationControls() {
  const simulationStatus = useLabStore((state) => state.simulationStatus)
  const simulationSpeed = useLabStore((state) => state.simulationSpeed)
  const playSimulation = useLabStore((state) => state.playSimulation)
  const pauseSimulation = useLabStore((state) => state.pauseSimulation)
  const nextEvent = useLabStore((state) => state.nextEvent)
  const previousEvent = useLabStore((state) => state.previousEvent)
  const resetSimulation = useLabStore((state) => state.resetSimulation)
  const setSimulationSpeed = useLabStore((state) => state.setSimulationSpeed)
  const resetDynamicTables = useLabStore((state) => state.resetDynamicTables)
  const clearSimulationTrace = useLabStore((state) => state.clearSimulationTrace)
  const isRunning = simulationStatus === 'running'
  const playbackLabel = isRunning ? 'Pause' : 'Play'
  const playbackClassName = isRunning
    ? 'simulation-toggle-button pause'
    : 'simulation-toggle-button play'
  const togglePlayback = isRunning ? pauseSimulation : playSimulation

  useEffect(() => {
    if (simulationStatus !== 'running') {
      return undefined
    }

    const intervalId = window.setInterval(nextEvent, 900 / simulationSpeed)

    return () => window.clearInterval(intervalId)
  }, [nextEvent, simulationSpeed, simulationStatus])

  return (
    <div className="simulation-controls" aria-label="Simulation Controls">
      <button
        type="button"
        className={playbackClassName}
        onClick={togglePlayback}
      >
        {playbackLabel}
      </button>
      <button
        type="button"
        className="simulation-reset-button"
        onClick={resetSimulation}
      >
        Reset
      </button>
      <button type="button" onClick={previousEvent}>
        Previous Event
      </button>
      <button type="button" onClick={nextEvent}>
        Next Event
      </button>
      <button
        type="button"
        className="simulation-reset-button"
        onClick={resetDynamicTables}
      >
        Reset Dynamic Tables
      </button>
      <button
        type="button"
        className="simulation-clear-button"
        onClick={clearSimulationTrace}
      >
        Clear Log
      </button>
      <select
        aria-label="Speed"
        value={simulationSpeed}
        onChange={(event) => setSimulationSpeed(Number(event.target.value))}
      >
        {speeds.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>
      <span>Status: {simulationStatus}</span>
    </div>
  )
}
