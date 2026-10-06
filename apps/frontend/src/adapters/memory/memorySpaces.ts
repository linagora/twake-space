import type { Space, SpacesService } from '@/application/spaces'

export function memorySpaces(seed: Space[]): SpacesService {
  const spaces = seed.map(space => ({ ...space }))
  return {
    list: () =>
      Promise.resolve(spaces.map(({ id, name, role }) => ({ id, name, role }))),
    get: id => {
      const space = spaces.find(candidate => candidate.id === id)
      return space
        ? Promise.resolve(space)
        : Promise.reject(Object.assign(new Error('no space'), { status: 404 }))
    },
    create: name => {
      const space: Space = {
        id: crypto.randomUUID(),
        name,
        role: 'admin',
        chat: true,
        mail: false,
        homeserverUrl: spaces[0]?.homeserverUrl ?? null,
        // A new space's apps are still preparing its resources.
        resources: [
          { kind: 'matrix_space', id: null },
          { kind: 'tasks', id: null },
          { kind: 'drive', id: null },
          { kind: 'mailbox', id: null },
          { kind: 'calendar', id: null }
        ]
      }
      spaces.push(space)
      return Promise.resolve({ id: space.id, name, role: space.role })
    }
  }
}
