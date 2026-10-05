#!/bin/sh
# Writes /.env.js and the security headers from the environment. The root filesystem
# is read-only: everything goes under /tmp/nginx.
set -eu

ME=$(basename "$0")
OUT=/tmp/nginx
RUNTIME_KEYS="API_URL TASKS_URL SSO_BASE_URL SSO_CLIENT_ID SSO_SCOPE SSO_REDIRECT_URI SSO_POST_LOGOUT_REDIRECT POSTHOG_KEY POSTHOG_HOST SENTRY_DSN SENTRY_ENVIRONMENT"

fail() {
  echo "$ME: error: $*" >&2
  exit 1
}

one_line() {
  case "$2" in
    *"
"*) fail "$1 must hold on one line" ;;
  esac
}

# A CSP source list ends up between double quotes in nginx and must not add directives.
check_sources() {
  one_line "$1" "$2"
  case "$2" in
    *[\"\\\$\;,]*) fail "$1 must not contain double quotes, backslashes, dollar signs, semicolons nor commas" ;;
  esac
}

# Drops the user info too: a Sentry DSN carries its public key there.
origin() {
  printf '%s' "$1" | sed -E 's#^(https?://)([^/?#@]*@)?([^/?#]+).*$#\1\3#'
}

mkdir -p "$OUT"

: >"$OUT/env.js"
for key in $RUNTIME_KEYS; do
  value=$(printenv "$key" || true)
  [ -n "$value" ] || continue
  one_line "$key" "$value"
  escaped=$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  printf 'var %s = "%s"\n' "$key" "$escaped" >>"$OUT/env.js"
done

connect_src="'self'"
# A relative API_URL is on 'self' already.
for url in "${API_URL:-}" "${SSO_BASE_URL:-}" "${POSTHOG_HOST:-}" "${SENTRY_DSN:-}"; do
  case "$url" in
    http://* | https://*) connect_src="$connect_src $(origin "$url")" ;;
  esac
done
[ -n "${CSP_CONNECT_SRC:-}" ] && connect_src="$connect_src $CSP_CONNECT_SRC"
frame_src=${CSP_FRAME_SRC:-"'self'"}
[ -n "${TASKS_URL:-}" ] && frame_src="$frame_src $(origin "$TASKS_URL")"
frame_ancestors=${CSP_FRAME_ANCESTORS:-"'self'"}
permissions_policy=${PERMISSIONS_POLICY:-"accelerometer=(), geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=()"}
check_sources CSP_CONNECT_SRC "$connect_src"
check_sources CSP_FRAME_SRC "$frame_src"
check_sources CSP_FRAME_ANCESTORS "$frame_ancestors"
one_line PERMISSIONS_POLICY "$permissions_policy"
case "$permissions_policy" in
  *[\"\\\$\;]*) fail "PERMISSIONS_POLICY must not contain double quotes, backslashes, dollar signs nor semicolons" ;;
esac

# style-src 'unsafe-inline': MUI (emotion) injects its styles at runtime.
csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
csp="$csp; img-src 'self' data: blob:; font-src 'self' data:"
csp="$csp; connect-src $connect_src; frame-src $frame_src"
csp="$csp; frame-ancestors $frame_ancestors"
csp="$csp; object-src 'none'; base-uri 'self'; form-action 'self'"

cat >"$OUT/security-headers.conf" <<EOF
add_header Content-Security-Policy "$csp" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "same-origin" always;
add_header Permissions-Policy "$permissions_policy" always;
EOF
