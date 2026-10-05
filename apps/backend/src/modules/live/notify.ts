import { eq, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import type { Tx } from '../../infra/db.ts'
import { spaceMembers } from '../spaces/schema.ts'
import type { LiveEvent, Streams } from './streams.ts'

const CHANNEL = 'live'
// A NOTIFY payload stays under 8000 bytes.
const USERS_PER_NOTIFY = 100

interface Message {
  event: LiveEvent
  users: string[]
  data: object
}

// Sent with the transaction, so a replica only hears about committed changes.
export async function tell(
  tx: Tx,
  event: LiveEvent,
  userIds: string[],
  data: object
): Promise<void> {
  const users = [...new Set(userIds)]
  for (let i = 0; i < users.length; i += USERS_PER_NOTIFY) {
    const message: Message = {
      event,
      users: users.slice(i, i + USERS_PER_NOTIFY),
      data
    }
    await tx.execute(
      sql`select pg_notify(${CHANNEL}, ${JSON.stringify(message)})`
    )
  }
}

export async function tellSpaceMembers(tx: Tx, spaceId: string) {
  const members = await tx
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, spaceId))
  await tell(
    tx,
    'spaces',
    members.map(m => m.userId),
    { spaceId }
  )
}

export async function listenForLive(
  client: postgres.Sql,
  streams: Pick<Streams, 'send'>
): Promise<void> {
  await client.listen(CHANNEL, payload => {
    const { event, users, data } = JSON.parse(payload) as Message
    for (const userId of users) streams.send(userId, event, data)
  })
}
