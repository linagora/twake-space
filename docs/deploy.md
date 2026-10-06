# Deploying and operating Twake Space

Twake Space ships as two container images:

- The frontend image serves the single page app with nginx.
- The backend image runs the Node.js API, the Kafka consumer and the background jobs.

## Runtime dependencies

```mermaid
flowchart LR
  browser[Browser]
  fe[Frontend image<br/>nginx :8080]
  be[Backend image<br/>API :8080, metrics :9464]
  pg[(PostgreSQL)]
  kafka[(Kafka)]
  ldap[ldap-rest]
  oidc[OIDC provider]
  hs[Matrix homeserver]
  cp[Chat control plane<br/>SaaS only]
  tasks[Tasks app]
  sentry[Sentry]
  posthog[PostHog]

  browser --> fe
  browser -->|API_URL| be
  browser -->|SSO_BASE_URL| oidc
  browser -->|TASKS_URL, in a frame| tasks
  browser -.-> sentry
  browser -.-> posthog
  be --> pg
  be -->|consume, dead letters| kafka
  be --> ldap
  be -->|discovery, introspection, userinfo, JWKS| oidc
  oidc -->|back-channel logout| be
  be -->|client-server API| hs
  hs -->|app service transactions| be
  be -.->|per-tenant homeserver| cp
  be -.-> sentry
```

## Images and CI

Both images go to `ghcr.io/<repository owner>/twake-space-frontend` and `ghcr.io/<repository owner>/twake-space-backend`. The workflows run per app, triggered by changes under `apps/<app>/` and the shared root files.

- Pull request: runs the app's check (`npm audit`, then `npm run check`, which lints, checks formatting, typechecks, tests and builds) and builds the image without pushing. The backend tests run against a `postgres:18` container.
- Push to `main`: runs the check, then builds and pushes the image tagged `latest`.
- Tag `frontend-vX.Y.Z` or `backend-vX.Y.Z`: verifies the tag (the commit is on `main`, the version is greater than the previous release, and it matches the app's `package.json`), runs the check, pushes the image tagged with the version and `latest`, then creates a GitHub release with generated notes.

The image build in CI runs `apps/<app>/docker/smoke-test.sh` when it exists. Only the frontend has one: it starts the image as in production (uid 101, read-only root filesystem, `/tmp` as tmpfs, all capabilities dropped) and checks the served files, cache headers, CSP and logs.

## Frontend

The frontend image builds the app with Node 24 and serves it from `nginxinc/nginx-unprivileged:1.31-alpine`.

- Runs as uid 101 and listens on port 8080.
- Supports a read-only root filesystem. It needs a writable `/tmp`, where the entrypoint script writes `/tmp/nginx` and nginx keeps its temporary files and pid.
- Docker `HEALTHCHECK` fetches `http://127.0.0.1:8080/healthz`.

### Served paths

- `/healthz` answers `200 ok`, not logged.
- `/.env.js` is the runtime configuration, sent with `Cache-Control: no-store`. `index.html` loads it before the app.
- `/static/` holds the hashed assets, sent with `Cache-Control: public, max-age=31536000, immutable`.
- Any other path falls back to `index.html`, sent with `Cache-Control: no-cache`.

### Runtime configuration

The entrypoint script `40-twake-space-runtime.sh` reads the environment at container start. Each variable below that is set and non-empty becomes a `var NAME = "value"` line in `/.env.js`. A value must fit on one line, or the container refuses to start.

- `API_URL`: the backend base URL, absolute or relative to the page origin. Required: the app throws at startup without it.
- `SSO_BASE_URL`, `SSO_CLIENT_ID`, `SSO_SCOPE`, `SSO_REDIRECT_URI`, `SSO_POST_LOGOUT_REDIRECT`: the OIDC login settings. All five are required: the app throws without any of them.
- `TASKS_URL`: the Tasks app, embedded in a frame. Optional.
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`: browser error reporting. Optional.
- `POSTHOG_KEY`, `POSTHOG_HOST`: written to `/.env.js`. See the open questions.

### Security headers

The script also writes the security headers, sent on every path except `/healthz`.

- `Content-Security-Policy` has a fixed part: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'`. `style-src` allows inline styles because MUI injects its styles at runtime.
- `connect-src` is `'self'` plus the origin of each of `API_URL`, `SSO_BASE_URL`, `POSTHOG_HOST` and `SENTRY_DSN` that is an absolute `http` or `https` URL. The origin drops the user info, so the Sentry public key stays out of the header. `CSP_CONNECT_SRC` appends more sources.
- `frame-src` is `CSP_FRAME_SRC` (default `'self'`) plus the origin of `TASKS_URL` when set.
- `frame-ancestors` is `CSP_FRAME_ANCESTORS` (default `'self'`). Set it when another app embeds Twake Space.
- `Permissions-Policy` is `PERMISSIONS_POLICY`, by default `accelerometer=(), geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=()`.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin` are fixed.

The CSP variables must not contain double quotes, backslashes, dollar signs, semicolons or commas, so they cannot add directives. `PERMISSIONS_POLICY` follows the same rule, commas allowed.

### Logs

nginx writes access logs to stdout and errors to stderr. The access log leaves out the query string, because the OIDC callback carries the code and state in it. `/healthz` and `/static/` are not logged.

## Backend

The backend image runs `node --import ./dist/instrument.js dist/main.js` on Node 24, as uid and gid 1000, with `NODE_ENV=production`. It exposes port 8080 (API) and 9464 (metrics). It has no Docker `HEALTHCHECK`; use the health endpoints below.

### Configuration

The backend reads its configuration from environment variables only, and refuses to start when one is invalid, listing every problem. There is no support for reading secrets from files: inject them as environment variables.

Required:

- `DATABASE_URL`: a `postgres://` or `postgresql://` URL.
- `KAFKA_BOOTSTRAP`: the Kafka bootstrap servers.
- `KAFKA_SECURITY`: `plaintext`, `ssl` or `sasl_ssl` (see Kafka below).
- `LDAP_REST_URL`: an `http` or `https` URL.
- `LDAP_REST_SERVICE_ID`: the service id for HMAC authentication to ldap-rest.
- `LDAP_REST_SECRET`: the HMAC secret, at least 32 characters.
- `OIDC_ISSUER`: an `https` issuer URL.
- `OIDC_CLIENT_SECRET`: the backend's client secret at the OIDC provider.

Optional, with defaults:

- `KAFKA_GROUP_ID`: consumer group, default `twake-space`.
- `OIDC_CLIENT_ID`: default `twakespace-backend`.
- `OIDC_AUDIENCE`: the audience access tokens must carry, default `twakespace`.
- `HTTP_HOST`: default `0.0.0.0`, used by both the API and the metrics server.
- `HTTP_PORT`: API port, default `8080`.
- `METRICS_PORT`: metrics port, default `9464`. Keep it off the public network.
- `LOG_LEVEL`: `fatal`, `error`, `warn`, `info`, `debug` or `trace`, default `info`.
- `MATRIX_LOCALPART`: `uid` or `email`, default `uid`. It tells the backend how Matrix user localparts map to directory users.
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`: error reporting. Unset `SENTRY_DSN` disables it.

Kafka security, by `KAFKA_SECURITY`:

- `plaintext`: nothing else.
- `ssl`: `KAFKA_SSL_CA`, `KAFKA_SSL_CERT` and `KAFKA_SSL_KEY`, all required. They are file paths, so mount the files into the container.
- `sasl_ssl`: `KAFKA_SASL_USERNAME` and `KAFKA_SASL_PASSWORD` required, `KAFKA_SSL_CA` optional (a file path). The mechanism is SCRAM-SHA-512.

Matrix homeserver, in one of two modes. Without either, the backend runs but posts nothing to Matrix.

- Single installation: set all of `MATRIX_HOMESERVER_URL`, `MATRIX_SERVER_NAME`, `MATRIX_AS_TOKEN` and `MATRIX_HS_TOKEN`. This one homeserver serves every organization.
- SaaS: set both `CHAT_CONTROL_PLANE_URL` and `CHAT_CONTROL_PLANE_TOKEN`. The control plane gives each organization its homeserver.
- Both modes need `SECRETS_KEY`: 32 random bytes in base64. The backend encrypts the homeserver tokens with it (AES-256-GCM) before storing them in Postgres. Changing it makes the stored tokens unreadable.
- Setting only part of a group, or both groups, is a configuration error.

### Startup

The backend starts in this order. A failure at any step stops the process.

1. Validates the configuration.
2. Applies the database migrations.
3. In single installation mode, writes the homeserver settings to the database and links every organization to it.
4. Runs OIDC discovery on `OIDC_ISSUER` (5 second timeout).
5. Opens the Postgres `LISTEN` channels for live updates and session revocations.
6. Starts the API and metrics servers.
7. Connects the Kafka dead letter producer and the consumer.
8. Starts the background jobs and reports ready.

On `SIGTERM` or `SIGINT` it reports not ready, stops the jobs, disconnects from Kafka, closes both servers and the Postgres pool, then flushes Sentry.

### Database migrations

Migrations run at every startup, from the `apps/backend/drizzle` folder shipped in the image, with the Drizzle migrator. There is no separate migration job. Developers generate new migrations with `npm run db:generate` (drizzle-kit).

### Health

On the API port:

- `GET /health/live` answers `200 {"status":"ok"}` once the server listens.
- `GET /health/ready` answers `200` when startup has finished and `select 1` succeeds on Postgres, `503 {"status":"unavailable"}` otherwise. It turns `503` as soon as shutdown starts.

Health requests are not logged. The metrics port answers `/health/live` and `/health/ready` too, but its readiness is always `200`: probe the API port.

### Metrics

`GET /metrics` on `METRICS_PORT` returns Prometheus text format with one gauge:

- `twake_space_cards_waiting{organization="<id>"}`: stored events not posted to Matrix yet, for each organization with chat available. Organizations with nothing waiting report 0, so alerts resolve.

### Logs and Sentry

- Logs are JSON lines from pino on stdout, at `LOG_LEVEL`. Kafka client logs carry `component: "kafka"`.
- Sentry is initialised before the app loads, so it instruments Fastify and pino. Log lines at `error` and `fatal` go to Sentry as errors.

## What the backend reaches

### PostgreSQL

- Holds all state and the migrations.
- Uses `LISTEN` and `NOTIFY` for live updates and session revocations across replicas.
- Uses advisory locks so only one replica runs the hourly purge and the single installation homeserver setup at a time.
- The hourly purge deletes feed events, messages and reactions after 365 days, notifications after 90 days, and Matrix app service transactions after 7 days.

### Kafka

The consumer reads from the beginning with manual offset commits, on these topics:

- `twake.chat.events.v1`
- `twake.mail.events.v1`
- `twake.drive.events.v1`
- `twake.calendar.events.v1`
- `twake.meet.events.v1`
- `twake.tasks.events.v1`
- `twake.platform.events.v1`

An event the backend cannot process goes to `<topic>.dlq.twake-space` (for example `twake.chat.events.v1.dlq.twake-space`) with a `twake-space-reason` header. The producer is idempotent with `acks` set to all.

### ldap-rest

The directory: organizations, users, groups and technical accounts. Calls are authenticated with HMAC (`LDAP_REST_SERVICE_ID`, `LDAP_REST_SECRET`). The backend does not call it at startup, only while serving requests and events.

### OIDC provider

- Discovery at startup, and the provider must publish a `jwks_uri`.
- Token introspection and userinfo for each access token, authenticated with client secret basic. The token must carry `OIDC_AUDIENCE`. Userinfo must return `sub`, `uuid`, `email` and `sid`, and `org_id` for organization users.
- The provider calls `POST /auth/backchannel-logout` on the API port with a logout token, signed with its JWKS and addressed to `OIDC_AUDIENCE`.

### Matrix homeserver

- The backend posts feed cards and joins rooms through the client-server API (`/_matrix/client/v3/...`) with the app service token, 10 second timeout. The poster runs every second, only when a homeserver or control plane is set.
- The homeserver pushes app service transactions to `PUT /_matrix/app/v1/transactions/:txnId` on the API port, authenticated with the homeserver token (bearer header or `access_token` query). The homeserver must reach the backend.

### Chat control plane (SaaS)

`GET <CHAT_CONTROL_PLANE_URL>/deployment/<organizationId>/twake-space` with the bearer token, 10 second timeout, when the backend first meets an organization and on `chat.deployment.completed` platform events. A `404` means the organization has no chat deployed yet.

## Local stack

`docker compose up` starts Kafka (creating the seven topics, with auto creation off) and Postgres. `docker compose --profile app up` also builds and runs both images. The frontend runs read-only with a tmpfs `/tmp`, as in production. Compose has no ldap-rest or SSO: see [Backend development](backend-dev.md#run-it).

## Open questions

- @rezk2ll The entrypoint writes `POSTHOG_KEY` and `POSTHOG_HOST` to `/.env.js` and adds `POSTHOG_HOST` to `connect-src`, but the frontend source does not read either. Is PostHog planned, or should the script drop them?
- @rezk2ll Kafka auto creation is off in compose, which creates only the seven input topics. Who creates the `<topic>.dlq.twake-space` topics in a deployment, and with which retention?
- @rezk2ll Several replicas start together and each runs the migrations. Does the Drizzle migrator lock against concurrent runs, or should one replica (or a job) migrate first?
- @rezk2ll The backend relies on Postgres `LISTEN`. Is a transaction pooling proxy (PgBouncer) in front of Postgres ruled out for deployments?
- @rezk2ll CI builds the images without a `platforms` setting. Is an arm64 image needed?
- @rezk2ll Both a push to `main` and a release tag move `latest`. Should deployments pin version tags only?
