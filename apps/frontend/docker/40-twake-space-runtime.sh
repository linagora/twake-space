#!/bin/sh
# Writes /.env.js and the security headers from the environment. The root filesystem
# is read-only: everything goes under /tmp/nginx.
set -eu

ME=$(basename "$0")
OUT=/tmp/nginx
RUNTIME_KEYS="API_URL TASKS_URL MAIL_URL DRIVE_URL CHAT_URL CALENDAR_URL SSO_BASE_URL SSO_CLIENT_ID SSO_SCOPE SSO_REDIRECT_URI SSO_POST_LOGOUT_REDIRECT POSTHOG_KEY POSTHOG_HOST SENTRY_DSN SENTRY_ENVIRONMENT SENTRY_FEEDBACK_ENABLED"

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
# Chat signs in inside its own frame: only its origin here.
[ -n "${CHAT_URL:-}" ] && frame_src="$frame_src $(origin "$CHAT_URL")"
# The Mail embed signs in through a frame on the SSO, and the Calendar embed
# by moving its frame to the SSO and back: with either, the SSO origin too.
for url in "${MAIL_URL:-}" "${CALENDAR_URL:-}"; do
  case "$url" in
    http://* | https://*) frame_src="$frame_src $(origin "$url")" ;;
  esac
done
if [ -n "${MAIL_URL:-}${CALENDAR_URL:-}" ]; then
  case "${SSO_BASE_URL:-}" in
    http://* | https://*) frame_src="$frame_src $(origin "$SSO_BASE_URL")" ;;
  esac
fi
frame_ancestors=${CSP_FRAME_ANCESTORS:-"'self'"}
img_src="'self' data: blob:"
[ -n "${CSP_IMG_SRC:-}" ] && img_src="$img_src $CSP_IMG_SRC"
permissions_policy=${PERMISSIONS_POLICY:-"accelerometer=(), geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=()"}
check_sources CSP_CONNECT_SRC "$connect_src"
check_sources CSP_FRAME_SRC "$frame_src"
check_sources CSP_FRAME_ANCESTORS "$frame_ancestors"
check_sources CSP_IMG_SRC "$img_src"
one_line PERMISSIONS_POLICY "$permissions_policy"
case "$permissions_policy" in
  *[\"\\\$\;]*) fail "PERMISSIONS_POLICY must not contain double quotes, backslashes, dollar signs nor semicolons" ;;
esac

# style-src 'unsafe-inline': MUI (emotion) injects its styles at runtime.
csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
csp="$csp; img-src $img_src; font-src 'self' data:"
csp="$csp; connect-src $connect_src; frame-src $frame_src"
csp="$csp; frame-ancestors $frame_ancestors"
csp="$csp; object-src 'none'; base-uri 'self'; form-action 'self'"

cat >"$OUT/security-headers.conf" <<EOF
add_header Content-Security-Policy "$csp" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "same-origin" always;
add_header Permissions-Policy "$permissions_policy" always;
EOF

api_upstream=${API_UPSTREAM:-}
if [ -z "$api_upstream" ]; then
  echo 'location /api/ { return 404; }' >"$OUT/api.conf"
else
  case "$api_upstream" in
    http://* | https://*) ;;
    *) fail "API_UPSTREAM must start with http:// or https://" ;;
  esac
  check_sources API_UPSTREAM "$api_upstream"
  case "$api_upstream" in
    *[[:space:]]* | *"'"* | *"{"* | *"}"*) fail "API_UPSTREAM must be a bare origin" ;;
  esac
  [ "${api_upstream%/}" = "$(origin "$api_upstream")" ] || fail "API_UPSTREAM must be a bare origin"
  # nginx ignores /etc/resolv.conf: a service name needs the resolver spelled out.
  resolver=$(awk '$1 == "nameserver" { print $2; exit }' /etc/resolv.conf)
  case "$resolver" in *:*) resolver="[$resolver]" ;; esac
  # The backend serves its routes at the root.
  cat >"$OUT/api.conf" <<EOF
location /api/ {
    resolver ${resolver:-127.0.0.11} valid=30s;
    set \$api_upstream "$(origin "$api_upstream")";
    rewrite ^/api(/.*)\$ \$1 break;
    proxy_pass \$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
fi
