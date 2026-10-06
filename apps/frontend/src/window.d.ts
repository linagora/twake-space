export {}

declare global {
  interface Window {
    API_URL?: string
    TASKS_URL?: string
    MAIL_URL?: string
    SSO_BASE_URL?: string
    SSO_CLIENT_ID?: string
    SSO_SCOPE?: string
    SSO_REDIRECT_URI?: string
    SSO_POST_LOGOUT_REDIRECT?: string
    SENTRY_DSN?: string
    SENTRY_ENVIRONMENT?: string
  }
}
