import type { KyInstance } from 'ky'

import type { Space, SpaceSummary, SpacesService } from '@/application/spaces'

export function httpSpaces(api: KyInstance): SpacesService {
  return {
    list: async () =>
      (await api.get('spaces').json<{ spaces: SpaceSummary[] }>()).spaces,
    get: id => api.get(`spaces/${encodeURIComponent(id)}`).json<Space>(),
    create: name => api.post('spaces', { json: { name } }).json<SpaceSummary>()
  }
}
