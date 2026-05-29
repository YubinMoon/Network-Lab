import { useState } from 'react'
import { useLabStore } from '../../store/useLabStore'

type TextSource = 'manual' | 'export' | 'share'

export function PersistenceControls() {
  const exportTopologyJson = useLabStore((state) => state.exportTopologyJson)
  const importTopologyJson = useLabStore((state) => state.importTopologyJson)
  const createShareUrl = useLabStore((state) => state.createShareUrl)
  const lastExportJson = useLabStore((state) => state.lastExportJson)
  const lastShareUrl = useLabStore((state) => state.lastShareUrl)
  const [manualText, setManualText] = useState('')
  const [textSource, setTextSource] = useState<TextSource>('manual')
  const textValue =
    textSource === 'export'
      ? lastExportJson
      : textSource === 'share'
        ? lastShareUrl
        : manualText
  const importText = textValue.trim().startsWith('{') ? textValue : ''

  return (
    <section className="persistence-controls" aria-label="Persistence">
      <h2>Share</h2>
      <div className="persistence-buttons">
        <button
          type="button"
          onClick={() => {
            exportTopologyJson()
            setTextSource('export')
          }}
        >
          Export JSON
        </button>
        <button type="button" onClick={() => importTopologyJson(importText)}>
          Import JSON
        </button>
        <button
          type="button"
          onClick={() => {
            createShareUrl()
            setTextSource('share')
          }}
        >
          Share URL
        </button>
      </div>
      <textarea
        aria-label="Import JSON"
        value={textValue}
        onChange={(event) => {
          setManualText(event.target.value)
          setTextSource('manual')
        }}
      />
    </section>
  )
}
