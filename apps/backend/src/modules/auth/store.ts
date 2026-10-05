import { eq, lt, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import type { Db } from '../../infra/db.ts'
import { oidcRevokedSessions, wsTickets } from './schema.ts'

const SESSION_REVOKED = 'session_revoked'

// Every replica hears it, so each closes the streams it holds for the session.
export async function listenForRevocations(
  client: postgres.Sql,
  onRevoked: (sessionId: string) => void
): Promise<void> {
  await client.listen(SESSION_REVOKED, onRevoked)
}

export interface Ticket {
  hash: string
  email: string
  sessionId: string
  organizationId: string
  tokenExpiresAt: Date
  expiresAt: Date
}

export interface AuthStore {
  isRevoked: (sessionId: string) => Promise<boolean>
  revoke: (sessionId: string, until: Date) => Promise<void>
  saveTicket: (ticket: Ticket) => Promise<void>
}

export function postgresAuthStore(db: Db): AuthStore {
  return {
    async isRevoked(sessionId) {
      const rows = await db
        .select({ sid: oidcRevokedSessions.sid })
        .from(oidcRevokedSessions)
        .where(eq(oidcRevokedSessions.sid, sessionId))
        .limit(1)
      return rows.length > 0
    },

    async revoke(sessionId, until) {
      await db.transaction(async tx => {
        await tx
          .delete(oidcRevokedSessions)
          .where(lt(oidcRevokedSessions.expiresAt, new Date()))
        await tx
          .insert(oidcRevokedSessions)
          .values({ sid: sessionId, expiresAt: until })
          .onConflictDoNothing()
        await tx.execute(
          sql`select pg_notify(${SESSION_REVOKED}, ${sessionId})`
        )
      })
    },

    async saveTicket(ticket) {
      await db.transaction(async tx => {
        await tx.delete(wsTickets).where(lt(wsTickets.expiresAt, new Date()))
        await tx.insert(wsTickets).values({
          ticketHash: ticket.hash,
          username: ticket.email,
          sid: ticket.sessionId,
          organizationId: ticket.organizationId,
          tokenExpiresAt: ticket.tokenExpiresAt,
          expiresAt: ticket.expiresAt
        })
      })
    }
  }
}
