import type { DirectoryService, Group, Person } from '@/application/directory'

export interface MemoryOrganization {
  people: (Person & { id: string })[]
  groups: Group[]
}

function matches(search: string, ...fields: string[]): boolean {
  const wanted = search.toLowerCase()
  return fields.some(field => field.toLowerCase().includes(wanted))
}

export function memoryDirectory(
  { people, groups }: MemoryOrganization,
  { pageSize = 20 } = {}
): DirectoryService {
  const page = <T>(found: T[], number: number) => {
    const start = (number - 1) * pageSize
    return {
      found: found.slice(start, start + pageSize),
      hasNextPage: found.length > start + pageSize
    }
  }
  return {
    people: (search, number) => {
      const { found, hasNextPage } = page(
        people.filter(p => matches(search, p.username, p.email, p.displayName)),
        number
      )
      return Promise.resolve({
        people: found.map(({ username, email, displayName }) => ({
          username,
          email,
          displayName
        })),
        hasNextPage
      })
    },
    groups: (search, number) => {
      const { found, hasNextPage } = page(
        groups.filter(g => matches(search, g.name)),
        number
      )
      return Promise.resolve({ groups: found, hasNextPage })
    }
  }
}
