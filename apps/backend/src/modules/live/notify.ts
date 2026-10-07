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
async function notify(tx: Tx, message: Message): Promise<void> {
  await tx.execute(
    sql`select pg_notify(${CHANNEL}, ${JSON.stringify(message)})`
  )
}

export async function tell(
  tx: Tx,
  event: LiveEvent,
  userIds: string[],
  data: object
): Promise<void> {
  const users = [...new Set(userIds)]
  for (let i = 0; i < users.length; i += USERS_PER_NOTIFY) {
    await notify(tx, {
      event,
      users: users.slice(i, i + USERS_PER_NOTIFY),
      data
    })
  }
}

export async function tellSpaceMembers(
  tx: Tx,
  spaceId: string,
  event: LiveEvent = 'spaces',
  data: object = { spaceId }
) {
  const members = await tx
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, spaceId))
  await tell(
    tx,
    event,
    members.map(m => m.userId),
    data
  )
}

export async function listenForLive(
  client: postgres.Sql,
  streams: Pick<Streams, 'send'>
): Promise<void> {
  await client.listen(CHANNEL, payload => {
    // A replica still on 0.1.8 sends settings by email during a rolling deploy.
    const message = JSON.parse(payload) as Message | { email: string }
    if (!('users' in message)) return
    for (const userId of message.users) {
      streams.send(userId, message.event, message.data)
    }
  })
}
