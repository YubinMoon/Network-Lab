import type { IcmpMessage, IPv4Datagram } from './types'

export function createIcmpEchoRequest({
  identifier = 1,
  sequenceNumber = 1,
  data = '',
}: {
  identifier?: number
  sequenceNumber?: number
  data?: string
}): IcmpMessage {
  return {
    type: 'echo-request',
    identifier,
    sequenceNumber,
    data,
  }
}

export function createIcmpEchoReply(request: IcmpMessage): IcmpMessage {
  return {
    type: 'echo-reply',
    identifier: request.identifier,
    sequenceNumber: request.sequenceNumber,
    data: request.data,
  }
}

export function isIcmpEchoRequest(datagram: IPv4Datagram): boolean {
  return (
    datagram.protocol === 'ICMP' &&
    'type' in datagram.payload &&
    datagram.payload.type === 'echo-request'
  )
}
