import type { KyInstance } from 'ky'

import type {
  Space,
  SpaceApp,
  SpaceSummary,
  SpacesService
} from '@/application/spaces'

export function httpSpaces(api: KyInstance): SpacesService {
  const space = (id: string, ...rest: string[]) =>
    ['spaces', id, ...rest].map(encodeURIComponent).join('/')
  const send = async (request: Promise<unknown>) => {
    await request
  }

  return {
    list: async () =>
      (await api.get('spaces').json<{ spaces: SpaceSummary[] }>()).spaces,
    get: id => api.get(space(id)).json<Space>(),
    apps: async () =>
      (await api.get('spaces/apps').json<{ apps: SpaceApp[] }>()).apps,
    create: json => api.post('spaces', { json }).json<SpaceSummary>(),
    edit: (id, json) => send(api.patch(space(id), { json })),
    remove: id => send(api.delete(space(id))),
    addMembers: (id, usernames, role) =>
      send(api.post(space(id, 'members'), { json: { usernames, role } })),
    setMemberRole: (id, userId, role) =>
      send(api.patch(space(id, 'members', userId), { json: { role } })),
    removeMember: (id, userId) =>
      send(api.delete(space(id, 'members', userId))),
    linkGroups: (id, groupIds, role) =>
      send(api.post(space(id, 'groups'), { json: { groupIds, role } })),
    setGroupRole: (id, groupId, role) =>
      send(api.patch(space(id, 'groups', groupId), { json: { role } })),
    unlinkGroup: (id, groupId) => send(api.delete(space(id, 'groups', groupId)))
  }
}
