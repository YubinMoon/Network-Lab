import { useLabStore } from '../../store/useLabStore'

export function PersistenceControls() {
  const createShareUrl = useLabStore((state) => state.createShareUrl)
  const lastShareUrl = useLabStore((state) => state.lastShareUrl)

  return (
    <section className="persistence-controls" aria-label="Persistence">
      <h2>Share</h2>
      <div className="persistence-buttons">
        <button type="button" onClick={createShareUrl}>
          Share URL
        </button>
      </div>
      <textarea
        aria-label="Share URL"
        readOnly
        value={lastShareUrl}
      />
    </section>
  )
}
