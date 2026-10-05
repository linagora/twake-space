import {
  NotFoundError,
  type LdapRestClient,
  type User
} from '@linagora/ldap-rest-client'
import { describe, expect, it, vi } from 'vitest'
import { ldapRestDirectory } from './ldap-rest.ts'

const user = {
  _id: '3f2a',
  cn: 'jdoe',
  sn: 'Doe',
  givenName: 'John',
  displayName: 'John Doe',
  mail: 'jdoe@acme.example.com',
  userPassword: 'hash',
  privateKey: 'secret',
  organizationId: 'org_acme'
} as User

const member = {
  username: 'jdoe',
  email: 'jdoe@acme.example.com',
  displayName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe'
}

function setup() {
  const organizations = {
    get: vi.fn<LdapRestClient['organizations']['get']>(),
    listUsers: vi.fn<LdapRestClient['organizations']['listUsers']>(),
    getUser: vi.fn<LdapRestClient['organizations']['getUser']>()
  }
  const users = { fetch: vi.fn<LdapRestClient['users']['fetch']>() }
  const client = { organizations, users } as unknown as LdapRestClient
  return { directory: ldapRestDirectory(client), organizations, users }
}

describe('ldapRestDirectory', () => {
  it('lists active members and keeps only directory fields', async () => {
    const { directory, organizations } = setup()
    organizations.listUsers.mockResolvedValue({
      users: [user],
      pagination: {
        page: 1,
        limit: 20,
        total: 21,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false
      }
    })

    const page = await directory.listMembers('org_acme', {
      page: 1,
      limit: 20,
      search: 'jo'
    })

    expect(organizations.listUsers).toHaveBeenCalledWith('org_acme', {
      page: 1,
      limit: 20,
      search: 'jo',
      status: 'active'
    })
    expect(page).toEqual({ members: [member], total: 21, hasNextPage: true })
  })

  it('finds a member by email', async () => {
    const { directory, organizations } = setup()
    organizations.getUser.mockResolvedValue(user)

    expect(
      await directory.findMember('org_acme', 'email', 'jdoe@acme.example.com')
    ).toEqual(member)
    expect(organizations.getUser).toHaveBeenCalledWith('org_acme', {
      by: 'email',
      value: 'jdoe@acme.example.com'
    })
  })

  it('returns undefined for an unknown member', async () => {
    const { directory, organizations } = setup()
    organizations.getUser.mockRejectedValue(new NotFoundError('user not found'))

    expect(
      await directory.findMember('org_acme', 'username', 'ghost')
    ).toBeUndefined()
  })

  it("resolves a member's organization from the user lookup", async () => {
    const { directory, users } = setup()
    users.fetch.mockResolvedValue(user)

    expect(await directory.organizationOf('jdoe@acme.example.com')).toBe(
      'org_acme'
    )
    expect(users.fetch).toHaveBeenCalledWith({
      by: 'email',
      value: 'jdoe@acme.example.com'
    })
  })

  it('has no organization for an unknown or B2C user', async () => {
    const { directory, users } = setup()
    users.fetch.mockRejectedValueOnce(new NotFoundError('user not found'))
    const b2cUser: User = { ...user }
    delete b2cUser.organizationId
    users.fetch.mockResolvedValueOnce(b2cUser)

    expect(await directory.organizationOf('ghost@example.com')).toBeUndefined()
    expect(await directory.organizationOf('b2c@example.com')).toBeUndefined()
  })

  it("reads an organization's domain and whether chat and mail are on", async () => {
    const { directory, organizations } = setup()
    organizations.get.mockResolvedValue({
      id: 'org_acme',
      name: 'Acme',
      domain: 'acme.example.com',
      baseDN: 'ou=org_acme,dc=example,dc=com',
      status: 'active',
      createdAt: new Date(),
      metadata: { isChatServerDeployed: true, isMailDomainValid: 'yes' }
    })

    expect(await directory.organization('org_acme')).toEqual({
      domain: 'acme.example.com',
      chat: true,
      mail: false
    })
  })

  it('has no unknown or deleted organization', async () => {
    const { directory, organizations } = setup()
    organizations.get.mockRejectedValueOnce(new NotFoundError('not found'))
    organizations.get.mockResolvedValueOnce({
      id: 'org_gone',
      name: 'Gone',
      domain: 'gone.example.com',
      baseDN: 'ou=org_gone,dc=example,dc=com',
      status: 'deleted',
      createdAt: new Date()
    })

    expect(await directory.organization('org_ghost')).toBeUndefined()
    expect(await directory.organization('org_gone')).toBeUndefined()
  })

  it('knows a live technical account of the organization', async () => {
    const { directory, organizations } = setup()
    organizations.getUser
      .mockResolvedValueOnce({ ...user, isTechnical: true })
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ ...user, isTechnical: true, isDeleted: true })
      .mockRejectedValueOnce(new NotFoundError('user not found'))

    const answers = [
      await directory.isTechnicalAccount('org_acme', '3f2a'),
      await directory.isTechnicalAccount('org_acme', '3f2a'),
      await directory.isTechnicalAccount('org_acme', '3f2a'),
      await directory.isTechnicalAccount('org_acme', '3f2a')
    ]

    expect(answers).toEqual([true, false, false, false])
    expect(organizations.getUser).toHaveBeenCalledWith('org_acme', {
      by: 'id',
      value: '3f2a'
    })
  })

  it('propagates other ldap-rest failures', async () => {
    const { directory, organizations } = setup()
    organizations.getUser.mockRejectedValue(new Error('ldap-rest unreachable'))

    await expect(
      directory.findMember('org_acme', 'username', 'jdoe')
    ).rejects.toThrow('ldap-rest unreachable')
  })
})
