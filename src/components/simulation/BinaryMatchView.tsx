import { toBinaryIpv4, toBinaryPrefixPattern } from '../../domain/ip'
import type { RouteEntry } from '../../domain/types'
import { useLabStore } from '../../store/useLabStore'

export function BinaryMatchView() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const currentEvent = simulationTrace?.events[currentEventIndex]
  const selectedRoute = currentEvent?.details?.selectedRoute as
    | RouteEntry
    | undefined

  if (!simulationTrace || !selectedRoute) {
    return <p className="empty-panel">No Longest Prefix Match</p>
  }

  return (
    <div className="binary-match">
      <h3>Destination IP</h3>
      <code>{simulationTrace.destinationIp}</code>
      <code>{toBinaryIpv4(simulationTrace.destinationIp)}</code>
      <h3>Selected Route</h3>
      <code>
        {selectedRoute.destinationNetwork}/{selectedRoute.prefixLength}
      </code>
      <code>
        {toBinaryPrefixPattern(
          selectedRoute.destinationNetwork,
          selectedRoute.prefixLength,
        )}
      </code>
      <p>Reason: Longest Prefix Match</p>
    </div>
  )
}
