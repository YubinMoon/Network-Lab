import { useState } from 'react'
import { useLabStore } from '../../store/useLabStore'

export function PersistenceControls() {
  const exportTopologyJson = useLabStore((state) => state.exportTopologyJson)
  const importTopologyJson = useLabStore((state) => state.importTopologyJson)
  const saveTopology = useLabStore((state) => state.saveTopology)
  const loadTopology = useLabStore((state) => state.loadTopology)
  const createShareUrl = useLabStore((state) => state.createShareUrl)
  const lastExportJson = useLabStore((state) => state.lastExportJson)
  const lastShareUrl = useLabStore((state) => state.lastShareUrl)
  const [importJson, setImportJson] = useState('')

  return (
    <section className="persistence-controls" aria-label="Persistence">
      <h2>Share</h2>
      <div className="persistence-buttons">
        <button type="button" onClick={exportTopologyJson}>
          Export JSON
        </button>
        <button type="button" onClick={() => importTopologyJson(importJson)}>
          Import JSON
        </button>
        <button type="button" onClick={saveTopology}>
          Save Local
        </button>
        <button type="button" onClick={loadTopology}>
          Load Local
        </button>
        <button type="button" onClick={createShareUrl}>
          Share URL
        </button>
      </div>
      <textarea
        aria-label="Import JSON"
        value={importJson || lastExportJson || lastShareUrl}
        onChange={(event) => setImportJson(event.target.value)}
      />
    </section>
  )
}
