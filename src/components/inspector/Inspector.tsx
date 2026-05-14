import { useLabStore } from '../../store/useLabStore'
import type { NetworkInterface, NetworkLink, NetworkNode } from '../../domain/types'

export function Inspector() {
  const topology = useLabStore((state) => state.topology)
  const selectedObject = useLabStore((state) => state.selectedObject)
  const deleteSelection = useLabStore((state) => state.deleteSelection)
  const selectedNode =
    selectedObject?.kind === 'node'
      ? topology.nodes.find((node) => node.id === selectedObject.id)
      : undefined
  const selectedLink =
    selectedObject?.kind === 'link'
      ? topology.links.find((link) => link.id === selectedObject.id)
      : undefined

  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {!selectedNode && !selectedLink ? <EmptySelection /> : null}
      {selectedNode ? <NodeInspector node={selectedNode} /> : null}
      {selectedLink ? (
        <LinkInspector link={selectedLink} nodes={topology.nodes} />
      ) : null}
      <SegmentSummary segments={topology.segments} />
      {selectedObject ? (
        <button type="button" className="danger-button" onClick={deleteSelection}>
          Delete Selection
        </button>
      ) : null}
    </aside>
  )
}

function SegmentSummary({
  segments,
}: {
  segments: Array<{
    id: string
    name: string
    type: string
    networkAddress: string
    prefixLength: number
    memberInterfaceIds: string[]
  }>
}) {
  return (
    <section>
      <h3>Network Segment</h3>
      {segments.length === 0 ? (
        <p>0 segments</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>CIDR</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.id}>
                <td>{segment.name}</td>
                <td>
                  {segment.networkAddress}/{segment.prefixLength}
                </td>
                <td>{segment.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function EmptySelection() {
  return (
    <section>
      <h3>Selection</h3>
      <p>No Selection</p>
    </section>
  )
}

function NodeInspector({ node }: { node: NetworkNode }) {
  return (
    <>
      <section>
        <h3>Selection</h3>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{node.name}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{nodeTypeLabel(node.type)}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Interface</h3>
        <InterfaceTable interfaces={node.interfaces} />
      </section>
      {node.type === 'host' ? (
        <section>
          <h3>ARP Cache</h3>
          <p>{node.arpCache.length} entries</p>
        </section>
      ) : null}
      {node.type === 'switch' ? (
        <section>
          <h3>MAC Address Table</h3>
          <p>{node.macAddressTable.length} entries</p>
        </section>
      ) : null}
      {node.type === 'router' ? (
        <section>
          <h3>Routing Table</h3>
          <p>{node.routingTable.length} entries</p>
        </section>
      ) : null}
    </>
  )
}

function InterfaceTable({ interfaces }: { interfaces: NetworkInterface[] }) {
  if (interfaces.length === 0) {
    return <p>No Interface</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>MAC Address</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {interfaces.map((networkInterface) => (
          <tr key={networkInterface.id}>
            <td>{networkInterface.name}</td>
            <td>{networkInterface.macAddress}</td>
            <td>{networkInterface.connectedLinkIds.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LinkInspector({
  link,
  nodes,
}: {
  link: NetworkLink
  nodes: NetworkNode[]
}) {
  const endpointA = endpointName(link.endpointA.nodeId, nodes)
  const endpointB = endpointName(link.endpointB.nodeId, nodes)

  return (
    <section>
      <h3>Link</h3>
      <dl>
        <div>
          <dt>Endpoint A</dt>
          <dd>{endpointA}</dd>
        </div>
        <div>
          <dt>Endpoint B</dt>
          <dd>{endpointB}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{link.status}</dd>
        </div>
        <div>
          <dt>Delay</dt>
          <dd>{link.delayMs} ms</dd>
        </div>
        <div>
          <dt>Loss Rate</dt>
          <dd>{link.lossRate}</dd>
        </div>
      </dl>
    </section>
  )
}

function nodeTypeLabel(type: string): string {
  if (type === 'host') {
    return 'Host'
  }

  if (type === 'switch') {
    return 'Switch'
  }

  return 'Router'
}

function endpointName(nodeId: string, nodes: NetworkNode[]): string {
  return nodes.find((node) => node.id === nodeId)?.name ?? nodeId
}
