import { useState } from 'react'
import { useLabStore } from '../../store/useLabStore'
import { applySimulationTraceToTopology } from '../../domain/dynamicTables'
import { stringDetail } from '../../domain/inspectionUtils'
import type {
  NetworkInterface,
  NetworkLink,
  NetworkNode,
  RouteEntry,
  RouterNode,
  SimulationEvent,
  TopologyState,
} from '../../domain/types'
import { ValidationPanel } from './ValidationPanel'
import { LinkPacketDetails } from './LinkPacketDetails'

export function Inspector() {
  const topology = useLabStore((state) => state.topology)
  const selectedObject = useLabStore((state) => state.selectedObject)
  const simulationTrace = useLabStore((state) => state.simulationTrace)
  const simulationBaseTopology = useLabStore(
    (state) => state.simulationBaseTopology,
  )
  const currentEventIndex = useLabStore((state) => state.currentEventIndex)
  const deleteSelection = useLabStore((state) => state.deleteSelection)
  const updateLinkMtu = useLabStore((state) => state.updateLinkMtu)
  const addRouterRoute = useLabStore((state) => state.addRouterRoute)
  const updateRouterRoute = useLabStore((state) => state.updateRouterRoute)
  const removeRouterRoute = useLabStore((state) => state.removeRouterRoute)
  const currentEvent = simulationTrace?.events[currentEventIndex]
  const inspectedTopology =
    simulationBaseTopology && simulationTrace
      ? applySimulationTraceToTopology(
          simulationBaseTopology,
          simulationTrace,
          currentEventIndex,
        )
      : topology
  const selectedRoute = currentEvent?.details?.selectedRoute as
    | { id: string }
    | undefined
  const selectedArpIpAddress =
    currentEvent?.type === 'arp-cache-updated' ||
    currentEvent?.type === 'arp-cache-hit'
      ? stringDetail(currentEvent.details, 'ipAddress')
      : undefined
  const selectedMacAddress =
    currentEvent?.type === 'switch-source-mac-learned'
      ? stringDetail(currentEvent.details, 'macAddress')
      : undefined
  const selectedNode =
    selectedObject?.kind === 'node'
      ? inspectedTopology.nodes.find((node) => node.id === selectedObject.id)
      : undefined
  const selectedLink =
    selectedObject?.kind === 'link'
      ? inspectedTopology.links.find((link) => link.id === selectedObject.id)
      : undefined

  return (
    <aside className="inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      <ValidationPanel />
      {!selectedNode && !selectedLink ? <EmptySelection /> : null}
      {selectedNode ? (
        <NodeInspector
          node={selectedNode}
          selectedRouteId={selectedRoute?.id}
          selectedArpIpAddress={
            currentEvent?.actorNodeId === selectedNode.id
              ? selectedArpIpAddress
              : undefined
          }
          selectedMacAddress={
            currentEvent?.actorNodeId === selectedNode.id
              ? selectedMacAddress
              : undefined
          }
          onAddRouterRoute={addRouterRoute}
          onUpdateRouterRoute={updateRouterRoute}
          onRemoveRouterRoute={removeRouterRoute}
        />
      ) : null}
      {selectedLink ? (
        <LinkInspector
          link={selectedLink}
          topology={inspectedTopology}
          nodes={inspectedTopology.nodes}
          currentEvent={currentEvent}
          onMtuChange={updateLinkMtu}
        />
      ) : null}
      <SegmentSummary segments={inspectedTopology.segments} />
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

function NodeInspector({
  node,
  selectedRouteId,
  selectedArpIpAddress,
  selectedMacAddress,
  onAddRouterRoute,
  onUpdateRouterRoute,
  onRemoveRouterRoute,
}: {
  node: NetworkNode
  selectedRouteId?: string
  selectedArpIpAddress?: string
  selectedMacAddress?: string
  onAddRouterRoute: (routerId: string) => void
  onUpdateRouterRoute: (
    routerId: string,
    routeId: RouteEntry['id'],
    patch: Partial<
      Pick<
        RouteEntry,
        | 'destinationNetwork'
        | 'prefixLength'
        | 'nextHopIp'
        | 'outInterfaceId'
        | 'metric'
        | 'enabled'
      >
    >,
  ) => void
  onRemoveRouterRoute: (routerId: string, routeId: RouteEntry['id']) => void
}) {
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
        <InterfaceTable
          interfaces={node.interfaces}
          showMacAddress={node.type !== 'switch'}
        />
      </section>
      {node.type === 'host' ? (
        <section>
          <h3>Default Gateway</h3>
          <p>{node.defaultGatewayIp ?? 'none'}</p>
        </section>
      ) : null}
      {node.type === 'host' ? (
        <section>
          <h3>ARP Cache</h3>
          <ArpCacheTable
            arpCache={node.arpCache}
            selectedIpAddress={selectedArpIpAddress}
          />
        </section>
      ) : null}
      {node.type === 'switch' ? (
        <section>
          <h3>MAC Address Table</h3>
          {node.macAddressTable.length === 0 ? (
            <p>0 entries</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>MAC Address</th>
                  <th>Interface</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {node.macAddressTable.map((entry) => (
                  <tr
                    className={
                      entry.macAddress === selectedMacAddress
                        ? 'highlight-row'
                        : undefined
                    }
                    key={entry.macAddress}
                  >
                    <td>{entry.macAddress}</td>
                    <td>{entry.portInterfaceId}</td>
                    <td>{entry.ageSeconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
      {node.type === 'router' ? (
        <section>
          <h3>ARP Cache</h3>
          <ArpCacheTable
            arpCache={node.arpCache}
            selectedIpAddress={selectedArpIpAddress}
          />
        </section>
      ) : null}
      {node.type === 'router' ? (
        <section>
          <h3>Routing Table</h3>
          <RoutingTableEditor
            key={node.id}
            router={node}
            selectedRouteId={selectedRouteId}
            onAddRoute={onAddRouterRoute}
            onUpdateRoute={onUpdateRouterRoute}
            onRemoveRoute={onRemoveRouterRoute}
          />
        </section>
      ) : null}
    </>
  )
}

function RoutingTableEditor({
  router,
  selectedRouteId,
  onAddRoute,
  onUpdateRoute,
  onRemoveRoute,
}: {
  router: RouterNode
  selectedRouteId?: string
  onAddRoute: (routerId: string) => void
  onUpdateRoute: (
    routerId: string,
    routeId: RouteEntry['id'],
    patch: Partial<
      Pick<
        RouteEntry,
        | 'destinationNetwork'
        | 'prefixLength'
        | 'nextHopIp'
        | 'outInterfaceId'
        | 'metric'
        | 'enabled'
      >
    >,
  ) => void
  onRemoveRoute: (routerId: string, routeId: RouteEntry['id']) => void
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <>
      <div className="routing-table-actions">
        <button type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? 'Done Editing' : 'Edit Routing Table'}
        </button>
      </div>
      {router.routingTable.length === 0 ? (
        <p>0 entries</p>
      ) : isEditing ? (
        <EditableRoutingTable
          router={router}
          selectedRouteId={selectedRouteId}
          onUpdateRoute={onUpdateRoute}
          onRemoveRoute={onRemoveRoute}
        />
      ) : (
        <ReadOnlyRoutingTable
          router={router}
          selectedRouteId={selectedRouteId}
        />
      )}
      {isEditing ? (
        <button
          type="button"
          disabled={router.interfaces.length === 0}
          onClick={() => onAddRoute(router.id)}
        >
          Add Manual Static
        </button>
      ) : null}
    </>
  )
}

function ReadOnlyRoutingTable({
  router,
  selectedRouteId,
}: {
  router: RouterNode
  selectedRouteId?: string
}) {
  return (
    <div className="routing-table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Enabled</th>
            <th>Destination</th>
            <th>Next Hop</th>
            <th>Out Interface</th>
            <th>Metric</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {router.routingTable.map((route) => (
            <tr
              className={route.id === selectedRouteId ? 'highlight-row' : undefined}
              key={route.id}
            >
              <td>{route.enabled ? 'Enabled' : 'Disabled'}</td>
              <td>{routeDestinationLabel(route)}</td>
              <td>{route.nextHopIp ?? '-'}</td>
              <td>{interfaceName(router, route.outInterfaceId)}</td>
              <td>{route.metric ?? 1}</td>
              <td>{routeTypeLabel(route.type)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditableRoutingTable({
  router,
  selectedRouteId,
  onUpdateRoute,
  onRemoveRoute,
}: {
  router: RouterNode
  selectedRouteId?: string
  onUpdateRoute: (
    routerId: string,
    routeId: RouteEntry['id'],
    patch: Partial<
      Pick<
        RouteEntry,
        | 'destinationNetwork'
        | 'prefixLength'
        | 'nextHopIp'
        | 'outInterfaceId'
        | 'metric'
        | 'enabled'
      >
    >,
  ) => void
  onRemoveRoute: (routerId: string, routeId: RouteEntry['id']) => void
}) {
  return (
    <div className="routing-table-wrapper">
      <table className="routing-table-editor">
        <thead>
          <tr>
            <th>Enabled</th>
            <th>Destination</th>
            <th>Next Hop</th>
            <th>Out Interface</th>
            <th>Metric</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {router.routingTable.map((route) => (
            <EditableRoutingTableRow
              key={route.id}
              router={router}
              route={route}
              selected={route.id === selectedRouteId}
              onUpdateRoute={onUpdateRoute}
              onRemoveRoute={onRemoveRoute}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditableRoutingTableRow({
  router,
  route,
  selected,
  onUpdateRoute,
  onRemoveRoute,
}: {
  router: RouterNode
  route: RouteEntry
  selected: boolean
  onUpdateRoute: (
    routerId: string,
    routeId: RouteEntry['id'],
    patch: Partial<
      Pick<
        RouteEntry,
        | 'destinationNetwork'
        | 'prefixLength'
        | 'nextHopIp'
        | 'outInterfaceId'
        | 'metric'
        | 'type'
        | 'enabled'
      >
    >,
  ) => void
  onRemoveRoute: (routerId: string, routeId: RouteEntry['id']) => void
}) {
  return (
    <tr className={selected ? 'highlight-row' : undefined}>
      <td>
        <input
          aria-label="Route Enabled"
          checked={route.enabled}
          name={`route-enabled-${route.id}`}
          type="checkbox"
          onChange={(event) =>
            onUpdateRoute(router.id, route.id, {
              enabled: event.target.checked,
            })
          }
        />
      </td>
      <td>
        <div className="route-cidr-inputs">
          <input
            aria-label="Destination Network"
            disabled={route.type === 'default'}
            name={`route-destination-${route.id}`}
            value={route.destinationNetwork}
            onChange={(event) =>
              onUpdateRoute(router.id, route.id, {
                destinationNetwork: event.target.value,
              })
            }
          />
          <input
            aria-label="Prefix Length"
            disabled={route.type === 'default'}
            max={32}
            min={0}
            name={`route-prefix-${route.id}`}
            type="number"
            value={route.prefixLength}
            onChange={(event) =>
              onUpdateRoute(router.id, route.id, {
                prefixLength: Number(event.target.value),
              })
            }
          />
        </div>
      </td>
      <td>
        <input
          aria-label="Next Hop"
          name={`route-next-hop-${route.id}`}
          value={route.nextHopIp ?? ''}
          onChange={(event) =>
            onUpdateRoute(router.id, route.id, {
              nextHopIp: event.target.value,
            })
          }
        />
      </td>
      <td>
        <select
          aria-label="Out Interface"
          name={`route-out-interface-${route.id}`}
          value={route.outInterfaceId}
          onChange={(event) =>
            onUpdateRoute(router.id, route.id, {
              outInterfaceId: event.target.value,
            })
          }
        >
          {router.interfaces.map((networkInterface) => (
            <option key={networkInterface.id} value={networkInterface.id}>
              {networkInterface.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          aria-label="Metric"
          min={1}
          name={`route-metric-${route.id}`}
          type="number"
          value={route.metric ?? 1}
          onChange={(event) =>
            onUpdateRoute(router.id, route.id, {
              metric: Number(event.target.value),
            })
          }
        />
      </td>
      <td>{routeTypeLabel(route.type)}</td>
      <td>
        <button
          className="danger-button"
          type="button"
          onClick={() => onRemoveRoute(router.id, route.id)}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function routeDestinationLabel(route: RouteEntry): string {
  return `${route.destinationNetwork}/${route.prefixLength}`
}

function interfaceName(router: RouterNode, interfaceId: string): string {
  return (
    router.interfaces.find(
      (networkInterface) => networkInterface.id === interfaceId,
    )?.name ?? interfaceId
  )
}

function routeTypeLabel(type: RouteEntry['type']): string {
  if (type === 'connected') {
    return 'Connected'
  }

  if (type === 'manual-static') {
    return 'Manual Static'
  }

  if (type === 'auto-static') {
    return 'Auto Static'
  }

  return 'Default'
}

function ArpCacheTable({
  arpCache,
  selectedIpAddress,
}: {
  arpCache: Array<{
    ipAddress: string
    macAddress: string
    interfaceId: string
    ageSeconds: number
  }>
  selectedIpAddress?: string
}) {
  if (arpCache.length === 0) {
    return <p>0 entries</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>IP Address</th>
          <th>MAC Address</th>
          <th>Interface</th>
        </tr>
      </thead>
      <tbody>
        {arpCache.map((entry) => (
          <tr
            className={
              entry.ipAddress === selectedIpAddress ? 'highlight-row' : undefined
            }
            key={`${entry.interfaceId}-${entry.ipAddress}`}
          >
            <td>{entry.ipAddress}</td>
            <td>{entry.macAddress}</td>
            <td>{entry.interfaceId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function InterfaceTable({
  interfaces,
  showMacAddress,
}: {
  interfaces: NetworkInterface[]
  showMacAddress: boolean
}) {
  if (interfaces.length === 0) {
    return <p>No Interface</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>IPv4</th>
          {showMacAddress ? <th>MAC Address</th> : null}
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {interfaces.map((networkInterface) => (
          <tr key={networkInterface.id}>
            <td>{networkInterface.name}</td>
            <td>
              {networkInterface.ipAddress && networkInterface.prefixLength
                ? `${networkInterface.ipAddress}/${networkInterface.prefixLength}`
                : '-'}
            </td>
            {showMacAddress ? <td>{networkInterface.macAddress}</td> : null}
            <td>{networkInterface.connectedLinkIds.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LinkInspector({
  link,
  topology,
  nodes,
  currentEvent,
  onMtuChange,
}: {
  link: NetworkLink
  topology: TopologyState
  nodes: NetworkNode[]
  currentEvent: SimulationEvent | undefined
  onMtuChange: (linkId: string, mtu: number) => void
}) {
  const endpointA = endpointName(link.endpointA.nodeId, nodes)
  const endpointB = endpointName(link.endpointB.nodeId, nodes)

  return (
    <>
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
          <div>
            <dt>MTU</dt>
            <dd>
              <input
                aria-label="MTU"
                id={`mtu-${link.id}`}
                min={28}
                name={`mtu-${link.id}`}
                type="number"
                value={link.mtu}
                onChange={(event) =>
                  onMtuChange(link.id, Number(event.target.value))
                }
              />
            </dd>
          </div>
        </dl>
      </section>
      <LinkPacketDetails
        topology={topology}
        link={link}
        currentEvent={currentEvent}
      />
    </>
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
