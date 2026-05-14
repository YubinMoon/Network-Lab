import { useMemo, useState } from 'react'
import { useLabStore } from '../../store/useLabStore'
import type { DestinationMode, PacketType } from '../../domain/types'

export function PacketGenerator() {
  const topology = useLabStore((state) => state.topology)
  const sendPacket = useLabStore((state) => state.sendPacket)
  const hosts = useMemo(
    () => topology.nodes.filter((node) => node.type === 'host'),
    [topology.nodes],
  )
  const [sourceHostId, setSourceHostId] = useState('')
  const [targetHostId, setTargetHostId] = useState('')
  const [destinationMode, setDestinationMode] =
    useState<DestinationMode>('host')
  const [destinationIp, setDestinationIp] = useState('')
  const [packetType, setPacketType] = useState<PacketType>('icmp-echo')
  const [ttl, setTtl] = useState(topology.settings.defaultTtl)
  const [payload, setPayload] = useState('Hello')
  const selectedSourceHostId = hosts.some((host) => host.id === sourceHostId)
    ? sourceHostId
    : hosts[0]?.id ?? ''
  const selectedTargetHostId = hosts.some((host) => host.id === targetHostId)
    ? targetHostId
    : hosts[1]?.id ?? hosts[0]?.id ?? ''

  const canSend =
    Boolean(selectedSourceHostId) &&
    (destinationMode === 'host'
      ? Boolean(selectedTargetHostId)
      : Boolean(destinationIp))

  return (
    <form
      className="packet-tool"
      onSubmit={(event) => {
        event.preventDefault()
        sendPacket({
          sourceHostId: selectedSourceHostId,
          destinationMode,
          targetHostId: selectedTargetHostId,
          destinationIp,
          packetType,
          ttl,
          packetCount: 1,
          intervalMs: topology.settings.defaultPacketIntervalMs,
          payload,
        })
      }}
    >
      <h2>Packet Generator</h2>
      <label>
        <span>Source Host</span>
        <select
          value={selectedSourceHostId}
          onChange={(event) => setSourceHostId(event.target.value)}
        >
          {hosts.map((host) => (
            <option key={host.id} value={host.id}>
              {host.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Destination Mode</span>
        <select
          value={destinationMode}
          onChange={(event) =>
            setDestinationMode(event.target.value as DestinationMode)
          }
        >
          <option value="host">Host</option>
          <option value="ip-address">IP Address</option>
        </select>
      </label>
      {destinationMode === 'host' ? (
        <label>
          <span>Target Host</span>
          <select
            value={selectedTargetHostId}
            onChange={(event) => setTargetHostId(event.target.value)}
          >
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>Destination IP</span>
          <input
            value={destinationIp}
            onChange={(event) => setDestinationIp(event.target.value)}
          />
        </label>
      )}
      <label>
        <span>Packet Type</span>
        <select
          value={packetType}
          onChange={(event) => setPacketType(event.target.value as PacketType)}
        >
          <option value="icmp-echo">ICMP Echo</option>
          <option value="generic-ipv4">Generic IPv4 Packet</option>
        </select>
      </label>
      <label>
        <span>TTL</span>
        <input
          type="number"
          min={1}
          value={ttl}
          onChange={(event) => setTtl(Number(event.target.value))}
        />
      </label>
      <label>
        <span>Payload</span>
        <input value={payload} onChange={(event) => setPayload(event.target.value)} />
      </label>
      <button type="submit" disabled={!canSend}>
        Send
      </button>
    </form>
  )
}
