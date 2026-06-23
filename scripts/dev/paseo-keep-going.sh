#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/intuitive-flow"
PID_FILE="$CACHE_DIR/paseo-keep-going.pid"
LOG_FILE="$CACHE_DIR/paseo-keep-going.log"

usage() {
    cat <<'EOF'
Usage: scripts/dev/paseo-keep-going.sh <start|stop|status|restart|run> [monitor options]

Starts a small background monitor that scans active Paseo agents for transient
model-capacity errors and sends one "keep going" prompt through `paseo send`.

Common monitor options:
  --dry-run              Report matches without sending prompts
  --interval <seconds>   Poll interval (default: 30)
  --cooldown <seconds>   Duplicate-send cooldown per agent (default: 600)
  --max-age-hours <n>    Only inspect agents created within n hours; 0 disables (default: 24)
  --tail <n>             Log lines to inspect per agent (default: 20)
  --statuses <csv>       Agent statuses to monitor (default: running)

Examples:
  scripts/dev/paseo-keep-going.sh start
  scripts/dev/paseo-keep-going.sh start --dry-run --interval 10
  scripts/dev/paseo-keep-going.sh run --once --dry-run --verbose
  scripts/dev/paseo-keep-going.sh stop
EOF
}

is_running() {
    [[ -f "$PID_FILE" ]] || return 1
    local pid
    pid="$(cat "$PID_FILE")"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" >/dev/null 2>&1
}

start_monitor() {
    mkdir -p "$CACHE_DIR"
    if is_running; then
        echo "paseo-keep-going already running: pid $(cat "$PID_FILE")"
        return 0
    fi

    cd "$ROOT_DIR"
    if command -v setsid >/dev/null 2>&1; then
        nohup setsid bun scripts/lib/paseo-keep-going.ts "$@" </dev/null >>"$LOG_FILE" 2>&1 &
    else
        nohup bun scripts/lib/paseo-keep-going.ts "$@" </dev/null >>"$LOG_FILE" 2>&1 &
    fi
    local pid=$!
    printf '%s\n' "$pid" >"$PID_FILE"
    disown "$pid" 2>/dev/null || true
    echo "started paseo-keep-going: pid $pid"
    echo "log: $LOG_FILE"
}

stop_monitor() {
    if ! is_running; then
        rm -f "$PID_FILE"
        echo "paseo-keep-going is not running"
        return 0
    fi

    local pid
    pid="$(cat "$PID_FILE")"
    kill "$pid"
    rm -f "$PID_FILE"
    echo "stopped paseo-keep-going: pid $pid"
}

status_monitor() {
    if is_running; then
        echo "paseo-keep-going running: pid $(cat "$PID_FILE")"
        echo "log: $LOG_FILE"
        return 0
    fi

    echo "paseo-keep-going is not running"
}

command="${1:-}"
if [[ -z "$command" || "$command" == "--help" || "$command" == "-h" ]]; then
    usage
    exit 0
fi
shift

case "$command" in
    start)
        start_monitor "$@"
        ;;
    stop)
        stop_monitor
        ;;
    status)
        status_monitor
        ;;
    restart)
        stop_monitor
        start_monitor "$@"
        ;;
    run)
        cd "$ROOT_DIR"
        exec bun scripts/lib/paseo-keep-going.ts "$@"
        ;;
    *)
        usage >&2
        exit 2
        ;;
esac
