import type { KyInstance } from 'ky'

import type { DirectoryService, Group, Person } from '@/application/directory'

function query(search: string, page: number) {
  return search ? { page, search } : { page }
}

export function httpDirectory(api: KyInstance): DirectoryService {
  return {
    people: async (search, page) => {
      const { members, hasNextPage } = await api
        .get('organization/members', { searchParams: query(search, page) })
        .json<{ members: Person[]; hasNextPage: boolean }>()
      return { people: members, hasNextPage }
    },
    groups: (search, page) =>
      api
        .get('organization/groups', { searchParams: query(search, page) })
        .json<{ groups: Group[]; hasNextPage: boolean }>()
  }
}
