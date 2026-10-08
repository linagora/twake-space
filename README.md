# Twake Space

One place for a team's chat, mail, files, calendar, meetings and boards across the Twake apps.

## Run it

You need Node 24 and Docker.

```bash
npm ci
docker compose up -d
cp apps/backend/.env.example apps/backend/.env
```

Fill in `LDAP_REST_SECRET` and `OIDC_CLIENT_SECRET` in `apps/backend/.env`, then put your API and SSO settings in `apps/frontend/public/.env.js`. The dev server forwards `/api` to the backend:

```js
var API_URL = '/api'
var TASKS_URL = 'https://tasks.twake.app/'
var SSO_BASE_URL = 'https://sign-up.twake.app/'
var SSO_CLIENT_ID = 'twakespace'
var SSO_SCOPE = 'openid email profile'
var SSO_REDIRECT_URI = 'http://localhost:3000/auth/callback'
var SSO_POST_LOGOUT_REDIRECT = 'http://localhost:3000/'
```

Start the backend and the frontend, and open http://localhost:3000.

```bash
npm run dev -w @twake-space/backend
npm run dev -w @twake-space/frontend
```

Run `npm run check` before you push. It's what CI runs.

To work on the frontend without a backend or SSO, run it on seed data with `npm run dev:mock -w @twake-space/frontend`.

## Publish it on the registry

Twake Space shows in the Twake Workplace home and bar as a standalone app. The app ships no code: [manifest/manifest.webapp](manifest/manifest.webapp) and its icon are the whole archive, and the home and the bar open the URL held by the `space.embedded-app-url` flag instead of a subdomain. Set that flag to the Twake Space URL on each context.

Every frontend release publishes the archive on the dev channel of the registry as `<version>-dev.<commit>` ([publish-manifest.yml](https://github.com/linagora/twake-workflows/blob/main/.github/workflows/publish-manifest.yml) in `frontend-release.yml`). The version comes from the release tag and must equal the one in `apps/frontend/package.json`; the manifest carries none.

## Docs

- [Frontend development](docs/frontend-dev.md): mock mode, code layout, adding a feature.
- [Backend development](docs/backend-dev.md): code layout, events, database, authentication, tests.
- [HTTP API](docs/api.md): every route, who can call it, and its answers.
- [Events](docs/events.md): from RabbitMQ and Matrix to Postgres, the feed and the browser.
- [Deploying](docs/deploy.md): the images, their configuration, and what the backend reaches.
