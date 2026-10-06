import { vi } from 'vitest'

import type { DirectoryService, Group, Person } from '@/application/directory'

export function fakeDirectory(
  people: Person[] = [],
  groups: Group[] = []
): DirectoryService {
  return {
    people: vi.fn(() => Promise.resolve({ people, hasNextPage: false })),
    groups: vi.fn(() => Promise.resolve({ groups, hasNextPage: false }))
  }
}
