import type { KyInstance } from 'ky'

import type { SpaceSummary, SpacesService } from '@/application/spaces'

export function httpSpaces(api: KyInstance): SpacesService {
  return {
    list: async () =>
      (await api.get('spaces').json<{ spaces: SpaceSummary[] }>()).spaces,
    create: name => api.post('spaces', { json: { name } }).json<SpaceSummary>()
  }
}
