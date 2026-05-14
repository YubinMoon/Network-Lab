import { Panel } from '@xyflow/react'
import { useLabStore } from '../../store/useLabStore'

export function PacketToken() {
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const currentEvent = simulationTrace?.events[currentEventIndex]

  if (!currentEvent) {
    return null
  }

  return (
    <Panel position="top-center">
      <div
        className={
          currentEvent.type === 'packet-dropped'
            ? 'packet-token dropped'
            : 'packet-token'
        }
      >
        {packetLabel(currentEvent.type)}
      </div>
    </Panel>
  )
}

function packetLabel(eventType: string): string {
  if (eventType === 'host-subnet-check') {
    return 'Host Check'
  }

  if (eventType === 'arp-request-sent') {
    return 'ARP Request'
  }

  if (eventType === 'arp-reply-sent') {
    return 'ARP Reply'
  }

  if (eventType.startsWith('switch-')) {
    return 'Switching'
  }

  if (eventType.startsWith('router-')) {
    return 'Routing'
  }

  if (eventType === 'packet-dropped') {
    return 'Dropped'
  }

  return 'IPv4 Datagram'
}
