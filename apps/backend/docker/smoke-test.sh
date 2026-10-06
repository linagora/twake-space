#!/usr/bin/env bash
# Boots the image as in production (uid 1000, read-only root filesystem, no capability)
# next to Postgres, Kafka and a stub OIDC issuer, then checks it serves and stops cleanly.
#
#   apps/backend/docker/smoke-test.sh twake-space-backend:dev
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
RUN="twake-space-backend-smoke-$$"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f "$RUN-backend" "$RUN-oidc" "$RUN-kafka" "$RUN-postgres" >/dev/null 2>&1 || true
  docker network rm "$RUN" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
DRIZZLE="$(cd "$(dirname "$0")/../drizzle" && pwd)"

docker network create "$RUN" >/dev/null

docker run -d --name "$RUN-postgres" --network "$RUN" --network-alias postgres \
  -e POSTGRES_USER=twake_space -e POSTGRES_PASSWORD=twake_space -e POSTGRES_DB=twake_space \
  postgres:18 >/dev/null

docker run -d --name "$RUN-kafka" --network "$RUN" --network-alias kafka \
  -e KAFKA_NODE_ID=1 -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092 \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=false \
  apache/kafka:4.2.2 >/dev/null

# The backend only accepts an https issuer: a self-signed one it is told to trust.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=oidc -addext subjectAltName=DNS:oidc \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" 2>/dev/null
chmod 644 "$WORK/key.pem" "$WORK/cert.pem"
cat >"$WORK/oidc.mjs" <<'EOF'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:https'
const issuer = 'https://oidc/'
const metadata = {
  issuer,
  jwks_uri: `${issuer}jwks`,
  token_endpoint: `${issuer}token`,
  introspection_endpoint: `${issuer}introspect`,
  userinfo_endpoint: `${issuer}userinfo`
}
createServer(
  { key: readFileSync('/work/key.pem'), cert: readFileSync('/work/cert.pem') },
  (request, response) => {
    response.setHeader('content-type', 'application/json')
    if (request.url === '/.well-known/openid-configuration') return response.end(JSON.stringify(metadata))
    if (request.url === '/introspect') return response.end('{"active":false}')
    if (request.url === '/jwks') return response.end('{"keys":[]}')
    response.statusCode = 404
    response.end('{}')
  }
).listen(443)
EOF
docker run -d --name "$RUN-oidc" --network "$RUN" --network-alias oidc \
  -v "$WORK:/work:ro" node:24-slim node /work/oidc.mjs >/dev/null

for _ in $(seq 1 60); do
  docker exec "$RUN-kafka" /opt/kafka/bin/kafka-broker-api-versions.sh \
    --bootstrap-server localhost:9092 >/dev/null 2>&1 && break
  sleep 2
done
for topic in twake.chat.events.v1 twake.mail.events.v1 twake.drive.events.v1 \
  twake.calendar.events.v1 twake.meet.events.v1 twake.tasks.events.v1 twake.platform.events.v1; do
  for name in "$topic" "$topic.dlq.twake-space"; do
    docker exec "$RUN-kafka" /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 \
      --create --if-not-exists --topic "$name" --partitions 1 --replication-factor 1 >/dev/null
  done
done
for _ in $(seq 1 30); do
  docker exec "$RUN-postgres" pg_isready -U twake_space >/dev/null 2>&1 && break
  sleep 1
done

docker run -d --name "$RUN-backend" --network "$RUN" \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -v "$WORK/cert.pem:/certs/oidc.pem:ro" -e NODE_EXTRA_CA_CERTS=/certs/oidc.pem \
  -p 127.0.0.1::8080 -p 127.0.0.1::9464 \
  -e KAFKA_BOOTSTRAP=kafka:9092 -e KAFKA_SECURITY=plaintext \
  -e DATABASE_URL=postgres://twake_space:twake_space@postgres:5432/twake_space \
  -e LDAP_REST_URL=http://ldap-rest:8081 -e LDAP_REST_SERVICE_ID=twake-space \
  -e LDAP_REST_SECRET=smoke-test-secret-that-is-long-enough \
  -e OIDC_ISSUER=https://oidc/ -e OIDC_CLIENT_SECRET=smoke-test \
  "$IMAGE" >/dev/null
API="http://$(docker port "$RUN-backend" 8080/tcp | head -1)"
METRICS="http://$(docker port "$RUN-backend" 9464/tcp | head -1)"

failures=0
expect() {
  # shellcheck disable=SC2053 # $3 is a glob pattern
  if [[ "$2" == $3 ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1: got '$2'"
    failures=$((failures + 1))
  fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@" || true; }

for _ in $(seq 1 60); do
  [[ "$(status "$API/health/ready")" == 200 ]] && break
  sleep 1
done

expect 'ready once started' "$(status "$API/health/ready")" '200'
expect 'alive with its Kafka consumer' "$(status "$API/health/live")" '200'
expect 'runs as uid 1000' "$(docker exec "$RUN-backend" stat -c %u /proc/1)" '1000'
expect 'applied every migration shipped' \
  "$(docker exec "$RUN-postgres" psql -U twake_space -tAc 'select count(*) from drizzle.__drizzle_migrations' 2>&1)" \
  "$(find "$DRIZZLE" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
expect 'API refuses a request without a token' "$(status "$API/spaces")" '401'
expect 'metrics served' "$(curl -fsS "$METRICS/metrics" 2>&1 || true)" '*twake_space_parked_events 0*'

docker kill -s TERM "$RUN-backend" >/dev/null
code="$(timeout 40 docker wait "$RUN-backend" || echo timeout)"
expect 'stops on SIGTERM with code 0' "$code" '0'

if ((failures > 0)); then
  echo "$failures check(s) failed; backend logs:"
  docker logs "$RUN-backend" 2>&1 | tail -40
  exit 1
fi
echo "all checks passed"
