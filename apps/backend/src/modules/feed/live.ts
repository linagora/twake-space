import type { Tx } from '../../infra/db.ts'
import { tellSpaceMembers } from '../live/notify.ts'

export type FeedChange = 'added' | 'changed' | 'removed'

export function tellFeed(
  tx: Tx,
  spaceId: string,
  itemId: string,
  change: FeedChange
): Promise<void> {
  return tellSpaceMembers(tx, spaceId, 'feed', { spaceId, itemId, change })
}
