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
    senderName: event.sender?.name,
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
  on(event: RoomEvent.TimelineReset, listener: OnReset): unknown
  off(event: RoomChange, listener: () => void): unknown
  off(event: RoomEvent.TimelineReset, listener: OnReset): unknown
}

type OnReset = (room: unknown, timelineSet: unknown) => void

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
        const timeline = timelineSet.getLiveTimeline()
        const more = await client.paginateEventTimeline(timeline, {
          backwards: true,
          limit: PAGE_SIZE
        })
        // A reset replaced the timeline this page belongs to.
        if (timeline !== timelineSet.getLiveTimeline()) return
        hasOlder = more
        emit()
      }

      const onReplaced = (event: MatrixEvent) => {
        if (event.getRoomId() === roomId) emit()
      }
      // After a gap in the sync the live timeline starts over empty.
      const onReset: OnReset = (_room, reset) => {
        if (reset !== timelineSet) return
        hasOlder = true
        emit()
        // On failure the feed still offers to load older entries.
        loadOlder().catch(() => undefined)
      }

      room.on(RoomEvent.Timeline, emit)
      room.on(RoomEvent.Redaction, emit)
      room.on(RoomEvent.TimelineReset, onReset)
      client.on(MatrixEventEvent.Replaced, onReplaced)
      emit()
      await loadOlder()
      return {
        loadOlder,
        close: () => {
          room.off(RoomEvent.Timeline, emit)
          room.off(RoomEvent.Redaction, emit)
          room.off(RoomEvent.TimelineReset, onReset)
          client.off(MatrixEventEvent.Replaced, onReplaced)
        }
      }
    }
  }
}
