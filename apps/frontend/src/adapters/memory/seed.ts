import type { MemoryOrganization } from '@/adapters/memory/memoryDirectory'
import type { FeedEntry } from '@/application/feed'
import type { User } from '@/application/session'
import type { Member, Space, SpaceRole } from '@/application/spaces'

// The same organization, people and roles as the local SSO stack, so moving
// from the mock to the real backend changes nothing on screen.
const DOMAIN = 'acme.twake.local'
const HOMESERVER = `https://matrix.${DOMAIN}`
const matrixId = (name: string) => `@${name}:${DOMAIN}`

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
  name: 'Alice Martin',
  email: `alice@${DOMAIN}`
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

export const seedSpaces: Space[] = [
  {
    id: 'roadmap',
    name: 'Roadmap',
    role: 'admin',
    createdAt: '2026-09-01T08:00:00.000Z',
    chat: true,
    mail: true,
    homeserverUrl: HOMESERVER,
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
    chat: true,
    mail: false,
    homeserverUrl: HOMESERVER,
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
    chat: false,
    mail: false,
    homeserverUrl: null,
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

function roadmapFeed(): FeedEntry[] {
  return Array.from({ length: 24 }, (_, i): FeedEntry => {
    const ts = START + i * HOUR
    const round = Math.floor(i / 4)
    const person = PEOPLE[round % PEOPLE.length] ?? 'alice'
    const actor = {
      type: 'user' as const,
      id: `uuid-${person}`,
      email: `${person}@${DOMAIN}`
    }
    switch (i % 4) {
      case 0:
        return {
          kind: 'card',
          id: `$task-${String(i)}`,
          ts,
          category: 'activities',
          app: 'tasks',
          actor,
          object: {
            type: 'task',
            id: `ROA-${String(i)}`,
            title: `ROA-${String(i)} Draft the Q${String((round % 4) + 1)} milestones`,
            url: `#task-${String(i)}`
          },
          preview: 'Moved to In progress'
        }
      case 1:
        return {
          kind: 'card',
          id: `$file-${String(i)}`,
          ts,
          category: 'files',
          app: 'drive',
          actor,
          object: {
            type: 'file',
            id: `file-${String(i)}`,
            title: `roadmap-v${String(i)}.pdf`,
            url: `#file-${String(i)}`
          },
          preview: null
        }
      case 2:
        return {
          kind: 'card',
          id: `$event-${String(i)}`,
          ts,
          category: 'events',
          app: 'calendar',
          actor,
          object: {
            type: 'event',
            id: `event-${String(i)}`,
            title: 'Roadmap review',
            url: `#event-${String(i)}`
          },
          preview: 'Thursday, 10:00'
        }
      default:
        return {
          kind: 'message',
          id: `$message-${String(i)}`,
          ts,
          sender: matrixId(person),
          senderName: person.charAt(0).toUpperCase() + person.slice(1),
          body: `Update ${String(i)}: the release notes are ready for review.`
        }
    }
  })
}

export const seedFeed: Record<string, FeedEntry[]> = {
  [ROADMAP_ROOM]: roadmapFeed(),
  [DESIGN_ROOM]: []
}
