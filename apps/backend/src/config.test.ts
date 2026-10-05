import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

const base = {
  KAFKA_BOOTSTRAP: 'localhost:9092',
  KAFKA_SECURITY: 'plaintext',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  LDAP_REST_URL: 'http://localhost:8081',
  LDAP_REST_SERVICE_ID: 'twake-space',
  LDAP_REST_SECRET: 'x'.repeat(32),
  OIDC_ISSUER: 'https://sso.example.com/',
  OIDC_CLIENT_SECRET: 'secret'
}

const homeserver = {
  MATRIX_HOMESERVER_URL: 'https://matrix.example.com',
  MATRIX_SERVER_NAME: 'example.com',
  MATRIX_AS_TOKEN: 'as',
  MATRIX_HS_TOKEN: 'hs',
  SECRETS_KEY: randomBytes(32).toString('base64')
}

const controlPlane = {
  CHAT_CONTROL_PLANE_URL: 'https://control-plane.example.com',
  CHAT_CONTROL_PLANE_TOKEN: 'cp'
}

describe('loadConfig', () => {
  it('has no homeserver unless one is configured', () => {
    expect(loadConfig(base).homeserver).toBeNull()
  })

  it('reads a configured homeserver and its key', () => {
    expect(loadConfig({ ...base, ...homeserver }).homeserver).toEqual({
      url: 'https://matrix.example.com',
      serverName: 'example.com',
      asToken: 'as',
      hsToken: 'hs',
      key: Buffer.from(homeserver.SECRETS_KEY, 'base64')
    })
  })

  it('refuses a homeserver configured in part', () => {
    expect(() =>
      loadConfig({ ...base, ...homeserver, MATRIX_HS_TOKEN: undefined })
    ).toThrow('MATRIX_HS_TOKEN')
  })

  it('reads the chat control plane that gives each tenant its homeserver', () => {
    const config = loadConfig({
      ...base,
      ...controlPlane,
      SECRETS_KEY: homeserver.SECRETS_KEY
    })

    expect(config.homeserver).toBeNull()
    expect(config.controlPlane).toEqual({
      url: 'https://control-plane.example.com',
      token: 'cp',
      key: Buffer.from(homeserver.SECRETS_KEY, 'base64')
    })
  })

  it('refuses a control plane configured in part, or with a homeserver', () => {
    expect(() =>
      loadConfig({
        ...base,
        CHAT_CONTROL_PLANE_URL: controlPlane.CHAT_CONTROL_PLANE_URL
      })
    ).toThrow('CHAT_CONTROL_PLANE_TOKEN')
    expect(() => loadConfig({ ...base, ...controlPlane })).toThrow(
      'SECRETS_KEY'
    )
    expect(() =>
      loadConfig({ ...base, ...homeserver, ...controlPlane })
    ).toThrow('CHAT_CONTROL_PLANE_URL')
  })

  it('refuses a key that is not 32 bytes', () => {
    expect(() =>
      loadConfig({ ...base, ...homeserver, SECRETS_KEY: 'c2hvcnQ=' })
    ).toThrow('SECRETS_KEY')
  })
})
