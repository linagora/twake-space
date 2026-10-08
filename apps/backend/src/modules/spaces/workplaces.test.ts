import { describe, expect, it, vi } from 'vitest'
import type { Directory } from '../../infra/ldap-rest.ts'
import { cachedWorkplaces } from './workplaces.ts'

function setUp() {
  let time = 0
  const workplaceFqdn = vi.fn<Directory['workplaceFqdn']>()
  const workplaces = cachedWorkplaces({ workplaceFqdn }, () => time)
  return {
    workplaces,
    workplaceFqdn,
    later: (ms: number) => {
      time += ms
    }
  }
}

describe('cachedWorkplaces', () => {
  it('asks the directory once per account', async () => {
    const { workplaces, workplaceFqdn } = setUp()
    workplaceFqdn.mockImplementation((_, id) =>
      Promise.resolve(id === 'alice' ? 'alice.twake.app' : null)
    )

    const first = await workplaces('org', ['alice', 'bob', 'alice'])
    const second = await workplaces('org', ['alice'])

    expect(first).toEqual(
      new Map([
        ['alice', 'alice.twake.app'],
        ['bob', null]
      ])
    )
    expect(second.get('alice')).toBe('alice.twake.app')
    expect(workplaceFqdn).toHaveBeenCalledTimes(2)
  })

  it('asks again once the address is ten minutes old', async () => {
    const { workplaces, workplaceFqdn, later } = setUp()
    workplaceFqdn
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('alice.twake.app')

    await workplaces('org', ['alice'])
    later(10 * 60 * 1000)

    expect((await workplaces('org', ['alice'])).get('alice')).toBe(
      'alice.twake.app'
    )
  })

  it('gives null when the directory fails, and asks again next time', async () => {
    const { workplaces, workplaceFqdn } = setUp()
    workplaceFqdn
      .mockRejectedValueOnce(new Error('ldap-rest unreachable'))
      .mockResolvedValueOnce('alice.twake.app')

    expect((await workplaces('org', ['alice'])).get('alice')).toBeNull()
    expect((await workplaces('org', ['alice'])).get('alice')).toBe(
      'alice.twake.app'
    )
  })
})
