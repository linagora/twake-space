import { describe, expect, it } from 'vitest'
import { organizationPlatformRoutes } from '../modules/organizations/availability.ts'
import { spacePlatformRoutes } from '../modules/spaces/events.ts'
import { PLATFORM_EVENTS } from './topology.ts'

describe('PLATFORM_EVENTS', () => {
  it('binds exactly the events a handler exists for', () => {
    const handled = [
      ...spacePlatformRoutes.keys(),
      ...organizationPlatformRoutes.keys()
    ]

    expect(Object.keys(PLATFORM_EVENTS).sort()).toEqual(handled.sort())
  })
})
