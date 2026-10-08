import type { MemoryOrganization } from '@/adapters/memory/memoryDirectory'
import type { FeedItem } from '@/application/feed'
import type { User } from '@/application/session'
import type { Member, Space, SpaceApp, SpaceRole } from '@/application/spaces'
import type { ApiToken, TokenOwner } from '@/application/tokens'

// The same organization, people and roles as the local SSO stack, so moving
// from the mock to the real backend changes nothing on screen.
const DOMAIN = 'acme.twake.local'
const HOMESERVER = `https://matrix.${DOMAIN}`

const person = (username: string, displayName: string) => ({
  id: `uuid-${username}`,
  username,
  email: `${username}@${DOMAIN}`,
  displayName
})

export const seedOrganization: MemoryOrganization = {
  people: [
    person('alice', 'Alice Martin'),
    person('bob', 'Bob Durand'),
    person('carol', 'Carol Petit'),
    person('dave', 'Dave Moreau')
  ],
  groups: [{ id: 'uuid-designers', name: 'Designers' }]
}

export const seedUser: User = {
  id: 'uuid-alice',
  name: 'Alice Martin',
  email: `alice@${DOMAIN}`,
  workplaceFqdn: null,
  idToken: null
}

const member = (username: string, role: SpaceRole): Member => ({
  id: `uuid-${username}`,
  username,
  email: `${username}@${DOMAIN}`,
  displayName:
    seedOrganization.people.find(p => p.username === username)?.displayName ??
    null,
  role
})
const designers = (role: SpaceRole) => ({
  id: 'uuid-designers',
  name: 'Designers',
  role
})

const ROADMAP_ROOM = `!roadmap:${DOMAIN}`
const DESIGN_ROOM = `!design-sprint:${DOMAIN}`

const ALL_APPS: SpaceApp[] = ['chat', 'tasks', 'drive', 'mail', 'calendar']

export const seedSpaces: Space[] = [
  {
    id: 'roadmap',
    name: 'Roadmap',
    role: 'admin',
    createdAt: '2026-09-01T08:00:00.000Z',
    pinnedAt: '2026-09-02T08:00:00.000Z',
    openedAt: '2026-10-07T08:00:00.000Z',
    color: '#46a2ff',
    description: 'What we ship this year, and when.',
    apps: ALL_APPS,
    chat: true,
    mail: true,
    homeserverUrl: HOMESERVER,
    banner: null,
    members: [
      member('alice', 'admin'),
      member('bob', 'editor'),
      member('dave', 'viewer')
    ],
    groups: [designers('viewer')],
    resources: [
      { kind: 'matrix_space', id: ROADMAP_ROOM },
      { kind: 'project', id: 'project-roadmap' },
      { kind: 'drive', id: 'drive-roadmap' },
      { kind: 'mailbox', id: `roadmap@${DOMAIN}` },
      { kind: 'calendar', id: 'calendar-roadmap' }
    ]
  },
  {
    id: 'design-sprint',
    name: 'Design Sprint',
    role: 'editor',
    createdAt: '2026-09-15T08:00:00.000Z',
    pinnedAt: null,
    openedAt: '2026-10-06T08:00:00.000Z',
    color: null,
    description: '',
    apps: ['chat', 'tasks', 'drive', 'calendar'],
    chat: true,
    mail: false,
    homeserverUrl: HOMESERVER,
    banner: null,
    members: [member('carol', 'admin'), member('alice', 'editor')],
    groups: [designers('editor')],
    resources: [
      { kind: 'matrix_space', id: DESIGN_ROOM },
      { kind: 'project', id: 'project-design' },
      { kind: 'drive', id: null },
      { kind: 'mailbox', id: null },
      { kind: 'calendar', id: 'calendar-design' }
    ]
  },
  {
    id: 'handover',
    name: 'Handover',
    role: 'viewer',
    createdAt: '2026-09-20T08:00:00.000Z',
    pinnedAt: null,
    openedAt: null,
    color: null,
    description: '',
    apps: ALL_APPS,
    chat: false,
    mail: false,
    homeserverUrl: null,
    banner: null,
    members: [member('dave', 'admin'), member('alice', 'viewer')],
    groups: [],
    resources: [
      { kind: 'matrix_space', id: null },
      { kind: 'project', id: 'project-handover' },
      { kind: 'drive', id: 'drive-handover' },
      { kind: 'mailbox', id: null },
      { kind: 'calendar', id: null }
    ]
  }
]

const START = Date.UTC(2026, 9, 1, 8)
const HOUR = 3_600_000
const PEOPLE = ['alice', 'bob', 'carol', 'dave']
const TASK_ACTIONS = ['created', 'assigned', 'moved', 'completed']

const iso = (ms: number) => new Date(ms).toISOString()

function roadmapFeed(): FeedItem[] {
  return Array.from({ length: 24 }, (_, i): FeedItem => {
    const time = iso(START + i * HOUR)
    const round = Math.floor(i / 4)
    const username = PEOPLE[round % PEOPLE.length] ?? 'alice'
    const actor = {
      type: 'user' as const,
      id: `uuid-${username}`,
      name: member(username, 'editor').displayName
    }
    const base = {
      id: `item-${String(i)}`,
      time,
      updatedAt: time,
      reactions:
        i % 5 === 0
          ? [
              { key: '👍', userIds: ['uuid-bob', 'uuid-alice'] },
              { key: '🎉', userIds: ['uuid-carol'] }
            ]
          : []
    }
    switch (i % 4) {
      case 0:
        return {
          ...base,
          kind: 'card',
          category: 'activities',
          type: `com.twake.tasks.task.${TASK_ACTIONS[round % 4] ?? 'created'}.v1`,
          actor,
          object: {
            type: 'task',
            id: `task-${String(i)}`,
            title: `Draft the Q${String((round % 4) + 1)} milestones`,
            container: { kind: 'project', id: 'project-roadmap' }
          },
          preview: null,
          state: {}
        }
      case 1:
        return {
          ...base,
          kind: 'card',
          category: 'messages',
          type: `com.twake.mail.message.${round % 2 ? 'sent' : 'received'}.v1`,
          actor: null,
          object: {
            type: 'message',
            id: `message-${String(i)}`,
            title: 'Q4 roadmap: partner feedback',
            container: { kind: 'mailbox', id: `roadmap@${DOMAIN}` }
          },
          preview: null,
          state: {}
        }
      case 2: {
        const start = Date.UTC(2026, 9, 9 + round, 9)
        return {
          ...base,
          kind: 'card',
          category: 'events',
          type: `com.twake.calendar.event.${round % 2 ? 'rescheduled' : 'created'}.v1`,
          actor,
          object: {
            type: 'event',
            id: `event-${String(i)}`,
            title: 'Roadmap review',
            container: { kind: 'calendar', id: 'calendar-roadmap' }
          },
          preview: null,
          state: {
            start: iso(start),
            end: iso(start + HOUR),
            allDay: false,
            location: 'Room 4',
            ...(round % 2 && {
              previous: { start: iso(start - HOUR), end: iso(start) }
            }),
            rsvp: { accepted: 2, declined: 0, tentative: 1, pending: 1 }
          }
        }
      }
      default:
        return {
          ...base,
          kind: 'post',
          category: 'messages',
          author: actor,
          body: `Update ${String(i)}: the release notes are ready for review.`,
          editedAt: null
        }
    }
  })
}

export const seedFeed: Record<string, FeedItem[]> = {
  roadmap: roadmapFeed(),
  'design-sprint': []
}

// Alice last saw Roadmap before its last 8 items.
export const seedFeedReads: Record<string, string> = {
  roadmap: iso(START + 15 * HOUR)
}

export const seedTokens: Record<TokenOwner, ApiToken[]> = {
  personal: [
    {
      id: 'token-alice-assistant',
      name: 'My assistant',
      scopes: ['space:read', 'feed:read'],
      spaces: 'all',
      role: null,
      expiresAt: '2026-12-31T00:00:00.000Z',
      lastUsedAt: '2026-10-06T16:20:00.000Z',
      createdAt: '2026-10-01T09:00:00.000Z'
    }
  ],
  organization: [
    {
      id: 'token-org-digest',
      name: 'Weekly digest agent',
      scopes: ['space:read', 'feed:read'],
      spaces: ['roadmap', 'design-sprint'],
      role: 'viewer',
      expiresAt: null,
      lastUsedAt: null,
      createdAt: '2026-09-15T09:00:00.000Z'
    }
  ]
}
