import {
  LdapRestClient,
  NotFoundError,
  type User
} from '@linagora/ldap-rest-client'
import type { Config } from '../config.ts'

export interface Member {
  username: string
  email: string
  displayName: string
  firstName: string
  lastName: string
}

export interface MemberPage {
  members: Member[]
  total: number
  hasNextPage: boolean
}

export interface Directory {
  listMembers(
    orgId: string,
    query: { page: number; limit: number; search?: string }
  ): Promise<MemberPage>
  listGroups(
    orgId: string,
    query: { page: number; limit: number; search?: string }
  ): Promise<{ groups: { id: string; name: string }[]; hasNextPage: boolean }>
  findMember(
    orgId: string,
    by: 'username' | 'email' | 'id',
    value: string
  ): Promise<Member | undefined>
  organizationOf(email: string): Promise<string | undefined>
  organization(orgId: string): Promise<Organization | undefined>
  isTechnicalAccount(orgId: string, accountId: string): Promise<boolean>
}

export interface Organization {
  domain: string
  chat: boolean
  mail: boolean
}

export function createLdapRestClient(config: Config): LdapRestClient {
  return new LdapRestClient({
    baseUrl: config.LDAP_REST_URL,
    auth: {
      type: 'hmac',
      serviceId: config.LDAP_REST_SERVICE_ID,
      secret: config.LDAP_REST_SECRET
    },
    // Calls run inside event transactions: a slow directory must not hold them.
    timeout: 5000,
    logger: { type: 'hidden' }
  })
}

export function ldapRestDirectory(
  client: Pick<LdapRestClient, 'organizations' | 'users' | 'groups'>
): Directory {
  return {
    async organizationOf(email) {
      const user = await notFoundAsUndefined(
        client.users.fetch({ by: 'email', value: email })
      )
      return user?.organizationId
    },
    async isTechnicalAccount(orgId, accountId) {
      const user = await notFoundAsUndefined(
        client.organizations.getUser(orgId, { by: 'id', value: accountId })
      )
      return user?.isTechnical === true && user.isDeleted !== true
    },
    async organization(orgId) {
      const organization = await notFoundAsUndefined(
        client.organizations.get(orgId)
      )
      if (!organization || organization.status === 'deleted') return undefined
      return {
        domain: organization.domain,
        chat: organization.metadata?.['isChatServerDeployed'] === true,
        mail: organization.metadata?.['isMailDomainValid'] === true
      }
    },
    async listMembers(orgId, query) {
      const { users, pagination } = await client.organizations.listUsers(
        orgId,
        { ...query, status: 'active' }
      )
      return {
        members: users.map(toMember),
        total: pagination.total,
        hasNextPage: pagination.hasNextPage
      }
    },
    async listGroups(orgId, query) {
      const { groups, pagination } = await client.groups.list(orgId, query)
      return {
        // The cn is the group's id; its name is in displayName, which the
        // client does not type yet.
        groups: groups.map(group => {
          const { displayName } = group as { displayName?: unknown }
          return {
            id: group.id,
            name: typeof displayName === 'string' ? displayName : group.cn
          }
        }),
        hasNextPage: pagination.page < pagination.totalPages
      }
    },
    async findMember(orgId, by, value) {
      const user = await notFoundAsUndefined(
        client.organizations.getUser(orgId, { by, value })
      )
      return user && toMember(user)
    }
  }
}

async function notFoundAsUndefined<T>(
  request: Promise<T>
): Promise<T | undefined> {
  try {
    return await request
  } catch (error) {
    if (error instanceof NotFoundError) return undefined
    throw error
  }
}

// ldap-rest puts the username in uid and the display name in cn; the client
// does not type uid yet.
function toMember(user: User): Member {
  return {
    username: (user as User & { uid: string }).uid,
    email: user.mail,
    displayName: user.displayName,
    firstName: user.givenName,
    lastName: user.sn
  }
}
