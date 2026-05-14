import { validateTopology } from '../../domain/validation'
import { useLabStore } from '../../store/useLabStore'

export function ValidationPanel() {
  const topology = useLabStore((state) => state.topology)
  const issues = validateTopology(topology)

  return (
    <section className="validation-panel" aria-label="Validation">
      <h3>Validation</h3>
      {issues.length === 0 ? (
        <p>No validation issues</p>
      ) : (
        <ul>
          {issues.map((issue) => (
            <li className={issue.severity} key={issue.id}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
