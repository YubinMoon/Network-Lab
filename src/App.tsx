import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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

type PanelResizeTarget = 'left' | 'right' | 'bottom'

interface PanelSizes {
  left: number
  right: number
  bottom: number
}

type WorkspaceStyle = CSSProperties & {
  '--left-panel-width': string
  '--right-panel-width': string
  '--bottom-panel-height': string
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  left: 240,
  right: 360,
  bottom: 320,
}

const PANEL_LIMITS = {
  left: { min: 180, max: 420 },
  right: { min: 300, max: 560 },
  bottom: { min: 180, max: 520 },
} satisfies Record<PanelResizeTarget, { min: number; max: number }>
const PANEL_KEYBOARD_STEP = 24

function App() {
  const addNode = useLabStore((state) => state.addNode)
  const clearTopology = useLabStore((state) => state.clearTopology)
  const loadTopologyFromHash = useLabStore((state) => state.loadTopologyFromHash)
  const segmentCount = useLabStore((state) => state.topology.segments.length)
  const [panelSizes, setPanelSizes] = useState(DEFAULT_PANEL_SIZES)
  const workspaceStyle = useMemo<WorkspaceStyle>(
    () => ({
      '--left-panel-width': `${panelSizes.left}px`,
      '--right-panel-width': `${panelSizes.right}px`,
      '--bottom-panel-height': `${panelSizes.bottom}px`,
    }),
    [panelSizes],
  )

  useEffect(() => {
    loadTopologyFromHash(window.location.hash)
  }, [loadTopologyFromHash])

  const startPanelResize =
    (target: PanelResizeTarget) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()

      const startX = event.clientX
      const startY = event.clientY
      const startSizes = panelSizes

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        setPanelSizes((currentSizes) =>
          resizePanelFromPointer(target, currentSizes, startSizes, deltaX, deltaY),
        )
      }

      const stopResize = () => {
        window.removeEventListener('pointermove', handlePointerMove)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopResize, { once: true })
    }

  const resizePanelWithKeyboard =
    (target: PanelResizeTarget) =>
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const keyDeltas = keyboardResizeDeltaMap(target)
      const delta = keyDeltas[event.key]

      if (delta === undefined) {
        return
      }

      event.preventDefault()
      setPanelSizes((currentSizes) => {
        const effectiveDelta = target === 'right' ? -delta : delta

        return {
          ...currentSizes,
          [target]: clampPanelSize(target, currentSizes[target] + effectiveDelta),
        }
      })
    }

  return (
    <main className="lab-shell">
      <header className="top-bar">
        <h1>IPv4 Network Visualization Lab</h1>
        <SimulationControls />
      </header>

      <section
        className="workspace"
        aria-label="Lab Workspace"
        style={workspaceStyle}
      >
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
          <PacketGenerator />
          <PersistenceControls />
        </aside>
        <div
          aria-label="Resize Left Panel"
          aria-orientation="vertical"
          aria-valuemax={PANEL_LIMITS.left.max}
          aria-valuemin={PANEL_LIMITS.left.min}
          aria-valuenow={panelSizes.left}
          className="panel-resizer panel-resizer-left"
          onKeyDown={resizePanelWithKeyboard('left')}
          onPointerDown={startPanelResize('left')}
          role="separator"
          tabIndex={0}
        />

        <section className="canvas" aria-label="Network Canvas">
          <div className="canvas-toolbar">
            <span>Network Segment: {segmentCount}</span>
            <span>Auto Configuration: On</span>
          </div>
          <NetworkCanvas />
        </section>

        <div
          aria-label="Resize Bottom Panel"
          aria-orientation="horizontal"
          aria-valuemax={PANEL_LIMITS.bottom.max}
          aria-valuemin={PANEL_LIMITS.bottom.min}
          aria-valuenow={panelSizes.bottom}
          className="panel-resizer panel-resizer-bottom"
          onKeyDown={resizePanelWithKeyboard('bottom')}
          onPointerDown={startPanelResize('bottom')}
          role="separator"
          tabIndex={0}
        />
        <SimulationPanel />
        <div
          aria-label="Resize Right Panel"
          aria-orientation="vertical"
          aria-valuemax={PANEL_LIMITS.right.max}
          aria-valuemin={PANEL_LIMITS.right.min}
          aria-valuenow={panelSizes.right}
          className="panel-resizer panel-resizer-right"
          onKeyDown={resizePanelWithKeyboard('right')}
          onPointerDown={startPanelResize('right')}
          role="separator"
          tabIndex={0}
        />
        <Inspector />
      </section>
    </main>
  )
}

function clampPanelSize(target: PanelResizeTarget, size: number): number {
  const limits = PANEL_LIMITS[target]

  return Math.min(limits.max, Math.max(limits.min, Math.round(size)))
}

function resizePanelFromPointer(
  target: PanelResizeTarget,
  currentSizes: PanelSizes,
  startSizes: PanelSizes,
  deltaX: number,
  deltaY: number,
): PanelSizes {
  if (target === 'left') {
    return {
      ...currentSizes,
      left: clampPanelSize('left', startSizes.left + deltaX),
    }
  }

  if (target === 'right') {
    return {
      ...currentSizes,
      right: clampPanelSize('right', startSizes.right - deltaX),
    }
  }

  return {
    ...currentSizes,
    bottom: clampPanelSize('bottom', startSizes.bottom - deltaY),
  }
}

function keyboardResizeDeltaMap(
  target: PanelResizeTarget,
): Record<string, number> {
  return target === 'bottom'
    ? { ArrowUp: PANEL_KEYBOARD_STEP, ArrowDown: -PANEL_KEYBOARD_STEP }
    : { ArrowLeft: -PANEL_KEYBOARD_STEP, ArrowRight: PANEL_KEYBOARD_STEP }
}

export default App
