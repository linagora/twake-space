import type {
  EventTimeline,
  Filter,
  IPaginateOpts,
  MatrixEvent,
  MatrixEventEvent,
  RoomEvent
} from 'matrix-js-sdk'

import {
  FEED_TYPES,
  toFeedEntry,
  type FeedEntry,
  type FeedService
} from '@/application/feed'

const PAGE_SIZE = 30

function toEntry(event: MatrixEvent): FeedEntry | null {
  const id = event.getId()
  const sender = event.getSender()
  if (!id || !sender) return null
  return toFeedEntry({
    id,
    type: event.getType(),
    sender,
    ts: event.getTs(),
    // The content of its latest edit, or {} once redacted.
    content: event.getContent()
  })
}

type Timeline = Pick<EventTimeline, 'getEvents'>

type RoomChange = RoomEvent.Timeline | RoomEvent.Redaction

// The part of a MatrixClient the feed uses. Methods, so a MatrixClient fits.
interface FeedRoom {
  getOrCreateFilteredTimelineSet(filter: Filter): {
    getLiveTimeline(): Timeline
  }
  on(event: RoomChange, listener: () => void): unknown
  off(event: RoomChange, listener: () => void): unknown
}

export interface FeedClient {
  getUserId(): string | null
  getRoom(roomId: string): FeedRoom | null
  paginateEventTimeline(
    timeline: Timeline,
    opts: IPaginateOpts
  ): Promise<boolean>
  on(
    event: MatrixEventEvent.Replaced,
    listener: (event: MatrixEvent) => void
  ): unknown
  off(
    event: MatrixEventEvent.Replaced,
    listener: (event: MatrixEvent) => void
  ): unknown
}

export function matrixFeed(clientOf: () => Promise<FeedClient>): FeedService {
  return {
    async open(roomId, filter, onChange) {
      const client = await clientOf()
      const { Filter, MatrixEventEvent, RoomEvent } =
        await import('matrix-js-sdk')
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`not in the Matrix space ${roomId}`)

      const definition = new Filter(
        client.getUserId(),
        `twake-space-feed-${filter}`
      )
      definition.setDefinition({
        room: { timeline: { types: FEED_TYPES[filter] } }
      })
      const timelineSet = room.getOrCreateFilteredTimelineSet(definition)

      let hasOlder = true
      const emit = () => {
        const entries = timelineSet
          .getLiveTimeline()
          .getEvents()
          .map(toEntry)
          .filter(entry => entry !== null)
        onChange({ entries, hasOlder })
      }
      const loadOlder = async () => {
        hasOlder = await client.paginateEventTimeline(
          timelineSet.getLiveTimeline(),
          { backwards: true, limit: PAGE_SIZE }
        )
        emit()
      }

      const onReplaced = (event: MatrixEvent) => {
        if (event.getRoomId() === roomId) emit()
      }

      room.on(RoomEvent.Timeline, emit)
      room.on(RoomEvent.Redaction, emit)
      client.on(MatrixEventEvent.Replaced, onReplaced)
      emit()
      await loadOlder()
      return {
        loadOlder,
        close: () => {
          room.off(RoomEvent.Timeline, emit)
          room.off(RoomEvent.Redaction, emit)
          client.off(MatrixEventEvent.Replaced, onReplaced)
        }
      }
    }
  }
}
