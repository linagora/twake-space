import { vi } from 'vitest'

import type {
  NewSpace,
  SpaceApp,
  SpaceSummary,
  SpacesService
} from '@/application/spaces'

export function fakeSpaces(initial: SpaceSummary[] = []): SpacesService {
  const spaces = [...initial]
  const write = () => vi.fn(() => Promise.resolve())
  return {
    list: vi.fn(() => Promise.resolve([...spaces])),
    get: vi.fn(() => Promise.reject(new Error('no space here'))),
    apps: vi.fn(() =>
      Promise.resolve<SpaceApp[]>([
        'feed',
        'chat',
        'tasks',
        'drive',
        'mail',
        'calendar'
      ])
    ),
    create: vi.fn(({ name, color }: NewSpace) => {
      const space: SpaceSummary = {
        id: `space-${String(spaces.length + 1)}`,
        name,
        role: 'admin',
        color
      }
      spaces.push(space)
      return Promise.resolve(space)
    }),
    rename: write(),
    remove: write(),
    addMembers: write(),
    setMemberRole: write(),
    removeMember: write(),
    linkGroups: write(),
    setGroupRole: write(),
    unlinkGroup: write()
  }
}
