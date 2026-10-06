import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { HttpServer } from '../../infra/http.ts'
import type { Directory } from '../../infra/ldap-rest.ts'
import type { Authorize } from '../auth/index.ts'

const PAGE_SIZE = 20

// ldap-rest needs two characters to search.
const query = z.object({
  search: z.string().trim().min(2).optional(),
  page: z.coerce.number().int().min(1).default(1)
})

function searchOf(request: FastifyRequest) {
  if (!request.caller) throw new Error('authorize let a request through')
  const result = query.safeParse(request.query)
  if (!result.success) return null
  const { search, page } = result.data
  return {
    orgId: request.caller.organizationId,
    query: { page, limit: PAGE_SIZE, ...(search && { search }) }
  }
}

// The people and groups a space admin picks from.
export function registerDirectoryRoutes(
  app: HttpServer,
  deps: {
    authorize: Authorize
    directory: Pick<Directory, 'listMembers' | 'listGroups'>
  }
) {
  const { authorize, directory } = deps

  app.get(
    '/organization/members',
    { preHandler: authorize() },
    async (request, reply) => {
      const search = searchOf(request)
      if (!search) return reply.code(400).send({ error: 'invalid_request' })
      const page = await directory.listMembers(search.orgId, search.query)
      return {
        members: page.members.map(({ username, email, displayName }) => ({
          username,
          email,
          displayName
        })),
        hasNextPage: page.hasNextPage
      }
    }
  )

  app.get(
    '/organization/groups',
    { preHandler: authorize() },
    async (request, reply) => {
      const search = searchOf(request)
      if (!search) return reply.code(400).send({ error: 'invalid_request' })
      return directory.listGroups(search.orgId, search.query)
    }
  )
}
