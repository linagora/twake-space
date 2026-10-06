import type { FeedEntry } from '@/application/feed'
import type { User } from '@/application/session'
import type { Space } from '@/application/spaces'

// The same organization, people and roles as the local SSO stack, so moving
// from the mock to the real backend changes nothing on screen.
const DOMAIN = 'acme.twake.local'
const HOMESERVER = `https://matrix.${DOMAIN}`
const matrixId = (name: string) => `@${name}:${DOMAIN}`

export const seedUser: User = {
  name: 'Alice Martin',
  email: `alice@${DOMAIN}`
}

const ROADMAP_ROOM = `!roadmap:${DOMAIN}`
const DESIGN_ROOM = `!design-sprint:${DOMAIN}`

export const seedSpaces: Space[] = [
  {
    id: 'roadmap',
    name: 'Roadmap',
    role: 'admin',
    chat: true,
    mail: true,
    homeserverUrl: HOMESERVER,
    resources: [
      { kind: 'matrix_space', id: ROADMAP_ROOM },
      { kind: 'tasks', id: 'board-roadmap' },
      { kind: 'drive', id: 'drive-roadmap' },
      { kind: 'mailbox', id: `roadmap@${DOMAIN}` },
      { kind: 'calendar', id: 'calendar-roadmap' }
    ]
  },
  {
    id: 'design-sprint',
    name: 'Design Sprint',
    role: 'editor',
    chat: true,
    mail: false,
    homeserverUrl: HOMESERVER,
    resources: [
      { kind: 'matrix_space', id: DESIGN_ROOM },
      { kind: 'tasks', id: 'board-design' },
      { kind: 'drive', id: null },
      { kind: 'mailbox', id: null },
      { kind: 'calendar', id: 'calendar-design' }
    ]
  },
  {
    id: 'handover',
    name: 'Handover',
    role: 'viewer',
    chat: false,
    mail: false,
    homeserverUrl: null,
    resources: [
      { kind: 'matrix_space', id: null },
      { kind: 'tasks', id: 'board-handover' },
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
          body: `Update ${String(i)}: the release notes are ready for review.`
        }
    }
  })
}

export const seedFeed: Record<string, FeedEntry[]> = {
  [ROADMAP_ROOM]: roadmapFeed(),
  [DESIGN_ROOM]: []
}
