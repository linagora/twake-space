import { randomBytes } from 'node:crypto'
import { pino } from 'pino'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { PlatformEvent } from '../../events/envelope.ts'
import type { Handler } from '../../events/router.ts'
import { lastChanges } from '../../events/schema.ts'
import type { Directory } from '../../infra/ldap-rest.ts'
import { createTestDb, type TestDb } from '../../infra/testing.ts'
import {
  meetingOrganizations,
  organizationPlatformRoutes
} from './availability.ts'
import { configureHomeserver } from './homeservers.ts'
import { homeservers, organizations } from './schema.ts'

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.drop())

beforeEach(async () => {
  await testDb.db.delete(organizations)
  await testDb.db.delete(homeservers)
  await testDb.db.delete(lastChanges)
})

function setUp(
  found: Awaited<ReturnType<Directory['organization']>>,
  homeserverId?: string
) {
  const directory = { organization: vi.fn(() => Promise.resolve(found)) }
  const other = vi.fn<Handler<PlatformEvent>>(() => Promise.resolve())
  const routes = meetingOrganizations(
    { directory, homeserverId },
    {
      get: key =>
        organizationPlatformRoutes.get(key) ??
        (key === 'twake.space.created' ? other : undefined)
    }
  )
  const handle = (routingKey: string, body: unknown) => {
    const handler = routes.get(routingKey)
    if (!handler) throw new Error(`no handler for ${routingKey}`)
    const event: PlatformEvent = { routingKey, messageId: 'msg-1', body }
    return testDb.db.transaction(tx =>
      handler(event, tx, pino({ level: 'silent' }))
    )
  }
  return { directory, other, handle }
}

const stored = () =>
  testDb.db
    .select({
      organizationId: organizations.organizationId,
      domain: organizations.domain,
      chat: organizations.chatAvailable,
      mail: organizations.mailAvailable
    })
    .from(organizations)

const acme = { domain: 'acme.example.com', chat: true, mail: false }

it('reads an organization from the directory the first time it is seen', async () => {
  const { directory, other, handle } = setUp(acme)

  await handle('twake.space.created', { organizationId: 'org_acme' })
  await handle('twake.space.created', { organizationId: 'org_acme' })

  expect(await stored()).toEqual([{ organizationId: 'org_acme', ...acme }])
  expect(directory.organization).toHaveBeenCalledOnce()
  expect(other).toHaveBeenCalledTimes(2)
})

it("points a new organization to a single installation's homeserver", async () => {
  const homeserverId = await configureHomeserver(testDb.db, randomBytes(32), {
    url: 'https://matrix.example.com',
    serverName: 'example.com',
    asToken: 'as',
    hsToken: 'hs'
  })
  const { handle } = setUp(acme, homeserverId)

  await handle('twake.space.created', { organizationId: 'org_acme' })

  expect(
    await testDb.db
      .select({ homeserverId: organizations.homeserverId })
      .from(organizations)
  ).toEqual([{ homeserverId }])
})

it('keeps an organization the directory does not have out of the copy', async () => {
  const { other, handle } = setUp(undefined)

  await handle('twake.space.created', { organizationId: 'org_ghost' })

  expect(await stored()).toEqual([])
  expect(other).toHaveBeenCalledOnce()
})

it('turns chat on when its deployment succeeds', async () => {
  const { handle } = setUp({ ...acme, chat: false })

  await handle('chat.deployment.completed', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    deployment: { status: 'failed', completedAt: '2026-10-05T09:00:00Z' }
  })
  const afterFailure = await stored()
  await handle('chat.deployment.completed', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    deployment: { status: 'succeeded', completedAt: '2026-10-05T09:10:00Z' }
  })

  expect(afterFailure).toMatchObject([{ chat: false }])
  expect(await stored()).toMatchObject([{ chat: true }])
})

it('takes a deployment without a status as a success', async () => {
  const { handle } = setUp({ ...acme, chat: false })

  await handle('chat.deployment.completed', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    deployment: {
      deploymentId: 'deploy_1',
      startedAt: '2026-10-05T08:50:00Z',
      completedAt: '2026-10-05T09:00:00Z',
      endpoints: {}
    }
  })

  expect(await stored()).toMatchObject([{ chat: true }])
})

it('turns chat off when it is deprovisioned, whatever order the events come in', async () => {
  const { handle } = setUp(acme)

  await handle('chat.deprovision', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    reason: 'disabled by admin',
    timestamp: '2026-10-05T10:00:00Z'
  })
  await handle('chat.deployment.completed', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    deployment: { status: 'succeeded', completedAt: '2026-10-05T09:00:00Z' }
  })

  expect(await stored()).toMatchObject([{ chat: false }])
})

it('sets mail from the DNS validation', async () => {
  const { handle } = setUp(acme)

  await handle('dns.validated', {
    organizationId: 'org_acme',
    domain: 'acme.example.com',
    dnsOwnershipValidated: true,
    chatDnsConfigurationValidated: false,
    mailDnsConfigurationValidated: true
  })

  expect(await stored()).toMatchObject([{ chat: true, mail: true }])
})
