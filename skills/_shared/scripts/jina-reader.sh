#!/usr/bin/env bash
set -euo pipefail

# Public-page fallback. Keep DNS handling here rather than in agent prompts.
jina_headers=()
if [[ "${1:-}" == "--fresh" ]]; then
    jina_headers=(--header 'X-No-Cache: true')
    shift
fi
if [[ $# -ne 1 || ! "$1" =~ ^https?://[^/[:space:]]+ ]]; then
    echo "Usage: bash jina-reader.sh [--fresh] PUBLIC_HTTP_URL" >&2
    exit 2
fi

jina_body=$(mktemp "${TMPDIR:-/tmp}/jina-reader.XXXXXX")
trap 'rm -f "$jina_body"' EXIT
jina_rc=1
for jina_doh in https://dns.google/dns-query https://cloudflare-dns.com/dns-query; do
    echo "Jina Reader via $jina_doh" >&2
    : > "$jina_body"
    if jina_status=$(curl -q -4 --fail --silent --show-error --globoff \
        --proto '=https' --doh-url "$jina_doh" \
        --connect-timeout 10 --max-time 45 \
        "${jina_headers[@]}" --output "$jina_body" --write-out '%{http_code}' \
        --url "https://r.jina.ai/$1"); then
        if [[ "$jina_status" != 2?? || ! -s "$jina_body" ]]; then
            echo "Jina Reader returned HTTP $jina_status or an empty body" >&2
            exit 1
        fi
        cat "$jina_body"
        exit 0
    else
        jina_rc=$?
    fi
    case "$jina_rc" in
        5|6|7|28|35|52|55|56|60|92) ;; # DNS, connection, TLS, or transfer failure
        *) exit "$jina_rc" ;; # HTTP/auth/quota or local setup error: no DNS retry
    esac
done
echo "Jina Reader failed through both DoH endpoints (curl $jina_rc)" >&2
exit "$jina_rc"
