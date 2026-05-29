import { useMemo } from 'react'
import { useLabStore } from '../../store/useLabStore'
import type { DestinationMode, PacketType } from '../../domain/types'

export function PacketGenerator() {
  return <PacketGeneratorForm />
}

function PacketGeneratorForm() {
  const topology = useLabStore((state) => state.topology)
  const input = useLabStore((state) => state.packetGeneratorInput)
  const updatePacketGeneratorInput = useLabStore(
    (state) => state.updatePacketGeneratorInput,
  )
  const sendPacket = useLabStore((state) => state.sendPacket)
  const hosts = useMemo(
    () => topology.nodes.filter((node) => node.type === 'host'),
    [topology.nodes],
  )
  const selectedSourceHostId = hosts.some((host) => host.id === input.sourceHostId)
    ? input.sourceHostId
    : hosts[0]?.id ?? ''
  const selectedTargetHostId = hosts.some((host) => host.id === input.targetHostId)
    ? input.targetHostId
    : hosts[1]?.id ?? hosts[0]?.id ?? ''

  const canSend =
    Boolean(selectedSourceHostId) &&
    (input.destinationMode === 'host'
      ? Boolean(selectedTargetHostId)
      : Boolean(input.destinationIp))

  return (
    <form
      className="packet-tool"
      onSubmit={(event) => {
        event.preventDefault()
        sendPacket({
          ...input,
          sourceHostId: selectedSourceHostId,
          targetHostId: selectedTargetHostId,
          intervalMs: topology.settings.defaultPacketIntervalMs,
        })
      }}
    >
      <h2>Packet Generator</h2>
      <label>
        <span>Source Host</span>
        <select
          value={selectedSourceHostId}
          onChange={(event) =>
            updatePacketGeneratorInput({ sourceHostId: event.target.value })
          }
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
          value={input.destinationMode}
          onChange={(event) =>
            updatePacketGeneratorInput({
              destinationMode: event.target.value as DestinationMode,
            })
          }
        >
          <option value="host">Host</option>
          <option value="ip-address">IP Address</option>
        </select>
      </label>
      {input.destinationMode === 'host' ? (
        <label>
          <span>Target Host</span>
          <select
            value={selectedTargetHostId}
            onChange={(event) =>
              updatePacketGeneratorInput({ targetHostId: event.target.value })
            }
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
            value={input.destinationIp}
            onChange={(event) =>
              updatePacketGeneratorInput({ destinationIp: event.target.value })
            }
          />
        </label>
      )}
      <label>
        <span>Packet Type</span>
        <select
          value={input.packetType}
          onChange={(event) =>
            updatePacketGeneratorInput({
              packetType: event.target.value as PacketType,
            })
          }
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
          value={input.ttl}
          onChange={(event) =>
            updatePacketGeneratorInput({ ttl: Number(event.target.value) })
          }
        />
      </label>
      <label>
        <span>Packet Count</span>
        <input
          type="number"
          min={1}
          value={input.packetCount}
          onChange={(event) =>
            updatePacketGeneratorInput({
              packetCount: Number(event.target.value),
            })
          }
        />
      </label>
      <label>
        <span>Payload</span>
        <input
          value={input.payload ?? ''}
          onChange={(event) =>
            updatePacketGeneratorInput({ payload: event.target.value })
          }
        />
      </label>
      <button type="submit" className="packet-send-button" disabled={!canSend}>
        Send
      </button>
    </form>
  )
}
