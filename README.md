# Twake Space

A space groups what a team has in the Twake apps (chat, mail, drive, calendar, meet, kanban) and shows its activity in one place.

## Layout

An npm workspaces monorepo:

- `apps/backend`: Node service. It consumes the activity and platform events from Kafka, keeps a copy of the spaces in Postgres, and publishes `twake.space.events.v1`.
- `apps/frontend`: React single-page app, served by nginx in production.
- `packages/*`: shared code, created when a second app needs it.

## Development

Node 24 (`nvm use`), Docker.

```bash
npm ci
docker compose up -d            # Kafka (topics created), Postgres
cp apps/backend/.env.example apps/backend/.env   # set LDAP_REST_SECRET
npm run dev -w @twake-space/backend
npm run dev -w @twake-space/frontend
```

`npm run check` runs lint, typecheck, tests and build for every app, as the CI does.

To run the production images locally: `docker compose --profile app up --build`.

## Images and releases

Each app has its own Dockerfile and workflows (`.github/workflows/<app>-*.yml`):

- a pull request checks the app and builds its image
- a push to `main` publishes `twake-space-<app>:latest` to Harbor
- a tag `<app>-vX.Y.Z` that matches `apps/<app>/package.json` publishes `twake-space-<app>:X.Y.Z` and a GitHub release

The frontend image writes `/.env.js` and its Content-Security-Policy from the environment at startup (`SSO_*`, `POSTHOG_*`, `CSP_CONNECT_SRC`, `CSP_FRAME_SRC`, `CSP_FRAME_ANCESTORS`, `PERMISSIONS_POLICY`). It runs as a non-root user with a read-only root filesystem.
