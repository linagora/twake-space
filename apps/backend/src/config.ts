import { z } from 'zod'

const kafkaSecurity = z.discriminatedUnion('KAFKA_SECURITY', [
  z.object({ KAFKA_SECURITY: z.literal('plaintext') }),
  z.object({
    KAFKA_SECURITY: z.literal('ssl'),
    KAFKA_SSL_CA: z.string().min(1),
    KAFKA_SSL_CERT: z.string().min(1),
    KAFKA_SSL_KEY: z.string().min(1)
  }),
  z.object({
    KAFKA_SECURITY: z.literal('sasl_ssl'),
    KAFKA_SASL_USERNAME: z.string().min(1),
    KAFKA_SASL_PASSWORD: z.string().min(1),
    KAFKA_SSL_CA: z.string().min(1).optional()
  })
])

const HOMESERVER_KEYS = [
  'MATRIX_HOMESERVER_URL',
  'MATRIX_SERVER_NAME',
  'MATRIX_AS_TOKEN',
  'MATRIX_HS_TOKEN',
  'SECRETS_KEY'
] as const

// Set on a single installation, where one homeserver serves every organization.
const homeserver = z
  .object({
    MATRIX_HOMESERVER_URL: z.url({ protocol: /^https?$/ }).optional(),
    MATRIX_SERVER_NAME: z.string().min(1).optional(),
    MATRIX_AS_TOKEN: z.string().min(1).optional(),
    MATRIX_HS_TOKEN: z.string().min(1).optional(),
    SECRETS_KEY: z
      .base64()
      .refine(
        key => Buffer.from(key, 'base64').length === 32,
        'must be 32 bytes in base64'
      )
      .optional()
  })
  .superRefine((env, ctx) => {
    const missing = HOMESERVER_KEYS.filter(key => env[key] === undefined)
    if (missing.length === HOMESERVER_KEYS.length) return
    for (const key of missing) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: 'required with the other homeserver settings'
      })
    }
  })
  .transform(env => {
    const {
      MATRIX_HOMESERVER_URL: url,
      MATRIX_SERVER_NAME: serverName,
      MATRIX_AS_TOKEN: asToken,
      MATRIX_HS_TOKEN: hsToken,
      SECRETS_KEY: key
    } = env
    return {
      homeserver:
        url && serverName && asToken && hsToken && key
          ? {
              url,
              serverName,
              asToken,
              hsToken,
              key: Buffer.from(key, 'base64')
            }
          : null
    }
  })

const configSchema = z
  .object({
    KAFKA_BOOTSTRAP: z.string().min(1),
    KAFKA_GROUP_ID: z.string().min(1).default('twake-space'),
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
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info')
  })
  .and(kafkaSecurity)
  .and(homeserver)

export type Config = z.infer<typeof configSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
