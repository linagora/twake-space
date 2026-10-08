import type { KyInstance } from 'ky'

import type { MeetingsService } from '@/application/meetings'

export function httpMeetings(api: KyInstance): MeetingsService {
  return {
    schedule: async (spaceId, json) => {
      await api.post(`spaces/${encodeURIComponent(spaceId)}/meetings`, {
        json
      })
    }
  }
}
