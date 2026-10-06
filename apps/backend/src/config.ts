import { z } from 'zod'
import { amqpTopology } from './events/topology.ts'

const HOMESERVER_KEYS = [
  'MATRIX_HOMESERVER_URL',
  'MATRIX_SERVER_NAME',
  'MATRIX_AS_TOKEN',
  'MATRIX_HS_TOKEN'
] as const
const CONTROL_PLANE_KEYS = [
  'CHAT_CONTROL_PLANE_URL',
  'CHAT_CONTROL_PLANE_TOKEN'
] as const

// A single installation sets its one homeserver, which serves every
// organization; SaaS sets the chat control plane, which gives each tenant's.
const homeserver = z
  .object({
    MATRIX_HOMESERVER_URL: z.url({ protocol: /^https?$/ }).optional(),
    MATRIX_SERVER_NAME: z.string().min(1).optional(),
    MATRIX_AS_TOKEN: z.string().min(1).optional(),
    MATRIX_HS_TOKEN: z.string().min(1).optional(),
    CHAT_CONTROL_PLANE_URL: z.url({ protocol: /^https?$/ }).optional(),
    CHAT_CONTROL_PLANE_TOKEN: z.string().min(1).optional(),
    SECRETS_KEY: z
      .base64()
      .refine(
        key => Buffer.from(key, 'base64').length === 32,
        'must be 32 bytes in base64'
      )
      .optional()
  })
  .superRefine((env, ctx) => {
    const complain = (key: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [key], message })
    }
    const groups = [HOMESERVER_KEYS, CONTROL_PLANE_KEYS].map(keys => ({
      keys,
      missing: keys.filter(key => env[key] === undefined)
    }))
    const used = groups.filter(g => g.missing.length < g.keys.length)
    for (const { missing } of used) {
      for (const key of missing) complain(key, 'required with the others')
    }
    if (used.length === 2) {
      for (const key of CONTROL_PLANE_KEYS) {
        complain(key, 'not with a single homeserver')
      }
    }
    if (used.length > 0 && env.SECRETS_KEY === undefined) {
      complain('SECRETS_KEY', 'required to store homeserver tokens')
    }
  })
  .transform(env => {
    const key = env.SECRETS_KEY && Buffer.from(env.SECRETS_KEY, 'base64')
    const {
      MATRIX_HOMESERVER_URL: url,
      MATRIX_SERVER_NAME: serverName,
      MATRIX_AS_TOKEN: asToken,
      MATRIX_HS_TOKEN: hsToken,
      CHAT_CONTROL_PLANE_URL: controlPlaneUrl,
      CHAT_CONTROL_PLANE_TOKEN: controlPlaneToken
    } = env
    return {
      homeserver:
        url && serverName && asToken && hsToken && key
          ? { url, serverName, asToken, hsToken, key }
          : null,
      controlPlane:
        controlPlaneUrl && controlPlaneToken && key
          ? { url: controlPlaneUrl, token: controlPlaneToken, key }
          : null
    }
  })

const configSchema = z
  .object({
    AMQP_URL: z.url({ protocol: /^amqps?$/ }),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LDAP_REST_URL: z.url({ protocol: /^https?$/ }),
    LDAP_REST_SERVICE_ID: z.string().min(1),
    LDAP_REST_SECRET: z.string().min(32),
    OIDC_ISSUER: z.url({ protocol: /^https$/ }),
    OIDC_AUDIENCE: z.string().min(1).default('twakespace'),
    OIDC_CLIENT_ID: z.string().min(1).default('twakespace-backend'),
    OIDC_CLIENT_SECRET: z.string().min(1),
    HTTP_HOST: z.string().min(1).default('0.0.0.0'),
    HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    // Kept off the public port.
    METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(9464),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    MATRIX_LOCALPART: z.enum(['uid', 'email']).default('uid')
  })
  .and(homeserver)
  .and(amqpTopology)

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
