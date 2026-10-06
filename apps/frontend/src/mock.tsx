import '@linagora/twake-css/dist/utils.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { memoryDirectory } from '@/adapters/memory/memoryDirectory'
import { memoryFeed } from '@/adapters/memory/memoryFeed'
import { memorySpaces } from '@/adapters/memory/memorySpaces'
import {
  seedFeed,
  seedOrganization,
  seedSpaces,
  seedUser
} from '@/adapters/memory/seed'
import { App } from '@/app/App'

// `npm run dev:mock`: the app on seed data, with no backend, SSO or homeserver.
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
  directory: memoryDirectory(seedOrganization),
  live: { subscribe: () => () => undefined },
  matrix: {
    signIn: () => Promise.resolve(true),
    signOut: () => Promise.resolve()
  },
  feed: memoryFeed(seedFeed),
  tasksUrl: window.TASKS_URL ?? null,
  mailUrl: window.MAIL_URL ?? null
}

createRoot(container).render(
  <StrictMode>
    <App session={session} services={services} />
  </StrictMode>
)
