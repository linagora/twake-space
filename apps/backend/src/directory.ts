import {
  LdapRestClient,
  NotFoundError,
  type User
} from '@linagora/ldap-rest-client'
import type { Config } from './config.ts'

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
  findMember(
    orgId: string,
    by: 'username' | 'email' | 'id',
    value: string
  ): Promise<Member | undefined>
  organizationOf(email: string): Promise<string | undefined>
}

export function createLdapRestClient(config: Config): LdapRestClient {
  return new LdapRestClient({
    baseUrl: config.LDAP_REST_URL,
    auth: {
      type: 'hmac',
      serviceId: config.LDAP_REST_SERVICE_ID,
      secret: config.LDAP_REST_SECRET
    },
    logger: { type: 'hidden' }
  })
}

export function ldapRestDirectory(
  client: Pick<LdapRestClient, 'organizations' | 'users'>
): Directory {
  return {
    async organizationOf(email) {
      const user = await notFoundAsUndefined(
        client.users.fetch({ by: 'email', value: email })
      )
      return user?.organizationId
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

function toMember(user: User): Member {
  return {
    username: user.cn,
    email: user.mail,
    displayName: user.displayName,
    firstName: user.givenName,
    lastName: user.sn
  }
}
