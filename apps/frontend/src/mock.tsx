import '@linagora/twake-css/dist/utils.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { memoryDirectory } from '@/adapters/memory/memoryDirectory'
import { memoryFeed } from '@/adapters/memory/memoryFeed'
import { memorySpaces } from '@/adapters/memory/memorySpaces'
import { memoryTokens } from '@/adapters/memory/memoryTokens'
import {
  seedFeed,
  seedOrganization,
  seedSpaces,
  seedTokens,
  seedUser
} from '@/adapters/memory/seed'
import { App } from '@/app/App'
import { NO_SETTINGS } from '@/application/settings'

// `npm run dev:mock`: the app on seed data, with no backend or SSO.
const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

const session = {
  start: () => Promise.resolve(seedUser),
  signIn: () => Promise.resolve(),
  signOut: () => {
    window.location.reload()
    return Promise.resolve()
  },
  onEndedElsewhere: () => () => undefined
}
const services = {
  spaces: memorySpaces(seedSpaces, seedOrganization),
  tokens: memoryTokens(seedTokens, {
    organizationAdmin: true,
    policy: { allowNoExpiry: true, maxLifetimeDays: 90 },
    // Legal shows an organization token reaching a space Alice is not in.
    spaces: [
      ...seedSpaces.map(({ id, name }) => ({ id, name })),
      { id: 'legal', name: 'Legal' }
    ]
  }),
  directory: memoryDirectory(seedOrganization),
  settings: { get: () => Promise.resolve(NO_SETTINGS) },
  live: { subscribe: () => () => undefined },
  feed: memoryFeed(seedFeed, {
    me: { id: 'uuid-alice', name: seedUser.name },
    roles: Object.fromEntries(seedSpaces.map(space => [space.id, space.role]))
  }),
  meetings: { schedule: () => Promise.resolve() },
  feedback: null,
  apiUrl: new URL('/api/', window.location.origin).href,
  tasksUrl: window.TASKS_URL ?? null,
  mailUrl: window.MAIL_URL ?? null,
  driveUrlTemplate: window.DRIVE_URL ?? null,
  chatUrl: window.CHAT_URL ?? null,
  calendarUrl: window.CALENDAR_URL ?? null,
  meetUrl: window.MEET_URL ?? null
}

createRoot(container).render(
  <StrictMode>
    <App session={session} services={services} />
  </StrictMode>
)
