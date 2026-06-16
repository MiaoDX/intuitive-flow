#!/bin/bash
# Sequential task runner for update orchestration.

_TR_NAMES=()
_TR_HINTS=()
_TR_STATUS=()
_TR_AWAITED=()
_TR_FAILED=()
_TR_LOGDIR=""
_TR_CLEANING_UP=false
_TR_COLOR_RESET=""
_TR_COLOR_RED=""
_TR_COLOR_YELLOW=""
_TR_COLOR_GREEN=""
_TR_COLOR_BLUE=""
_TR_COLOR_BOLD=""

task_init() {
    _TR_LOGDIR=$(mktemp -d)
    exec 3>&1
    export TASK_NOTICE_FD=3
    if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
        _TR_COLOR_RESET=$'\033[0m'
        _TR_COLOR_RED=$'\033[31m'
        _TR_COLOR_YELLOW=$'\033[33m'
        _TR_COLOR_GREEN=$'\033[32m'
        _TR_COLOR_BLUE=$'\033[34m'
        _TR_COLOR_BOLD=$'\033[1m'
    fi
    trap _tr_on_exit EXIT
    trap '_tr_on_signal INT 130' INT
    trap '_tr_on_signal TERM 143' TERM
    trap '_tr_on_signal HUP 129' HUP
}

task_notice() {
    local message="$*"

    if [[ "${TASK_NOTICE_FD:-}" =~ ^[0-9]+$ ]]; then
        { printf '  %s->%s %s\n' "$_TR_COLOR_BLUE" "$_TR_COLOR_RESET" "$message" >&"$TASK_NOTICE_FD"; } 2>/dev/null || true
    fi
}

task_warn() {
    local color="" reset=""
    if [ -t 1 ]; then
        color="$_TR_COLOR_YELLOW"
        reset="$_TR_COLOR_RESET"
    fi
    printf '  %s!%s %s\n' "$color" "$reset" "$*"
}

task_success() {
    local color="" reset=""
    if [ -t 1 ]; then
        color="$_TR_COLOR_GREEN"
        reset="$_TR_COLOR_RESET"
    fi
    printf '  %s✓%s %s\n' "$color" "$reset" "$*"
}

_tr_extra_cleanup() {
    local cleanup_fn="${TASK_RUNNER_EXTRA_CLEANUP:-}"

    [ -n "$cleanup_fn" ] || return 0
    declare -F "$cleanup_fn" >/dev/null 2>&1 || return 0
    "$cleanup_fn"
}

_tr_on_exit() {
    if [ "$_TR_CLEANING_UP" = true ]; then
        return 0
    fi

    _TR_CLEANING_UP=true
    _tr_extra_cleanup
    [ -n "${_TR_LOGDIR:-}" ] && rm -rf "$_TR_LOGDIR"
    exec 3>&- 2>/dev/null || true
}

_tr_on_signal() {
    local signal_name="$1"
    local exit_code="$2"

    trap - INT TERM HUP EXIT
    _TR_CLEANING_UP=true

    echo
    task_warn "interrupted by SIG$signal_name; stopping update"
    _tr_extra_cleanup
    [ -n "${_TR_LOGDIR:-}" ] && rm -rf "$_TR_LOGDIR"
    exec 3>&- 2>/dev/null || true
    exit "$exit_code"
}

_tr_index_of() {
    local needle="$1" i
    for i in "${!_TR_NAMES[@]}"; do
        if [ "${_TR_NAMES[$i]}" = "$needle" ]; then
            echo "$i"
            return 0
        fi
    done
    return 1
}

_section() {
    echo ""
    printf '%s== %s ==%s\n' "$_TR_COLOR_BOLD" "$1" "$_TR_COLOR_RESET"
}

_tr_print_log_line() {
    local line="$1"

    if [ -z "$_TR_COLOR_RESET" ]; then
        printf '%s\n' "$line"
        return 0
    fi

    if [[ "$line" =~ ^([[:space:]]*)!([[:space:]].*)$ ]]; then
        local marker_color="$_TR_COLOR_YELLOW"
        local indent="${BASH_REMATCH[1]}"
        local message="${BASH_REMATCH[2]}"
        if [[ "$line" =~ ([Ff]ail|[Ff]ailed|[Ee]rror|failed[[:space:]]+after[[:space:]]+install) ]]; then
            marker_color="$_TR_COLOR_RED"
        fi
        printf '%s%s!%s%s\n' "$indent" "$marker_color" "$_TR_COLOR_RESET" "$message"
    elif [[ "$line" =~ ^(npm[[:space:]]+error|error:|Error:) ]]; then
        printf '%s%s%s\n' "$_TR_COLOR_RED" "$line" "$_TR_COLOR_RESET"
    elif [[ "$line" =~ ^(npm[[:space:]]+warn|warn:) ]]; then
        printf '%s%s%s\n' "$_TR_COLOR_YELLOW" "$line" "$_TR_COLOR_RESET"
    else
        printf '%s\n' "$line"
    fi
}

_tr_print_log() {
    local log_file="$1"
    local line

    [ -f "$log_file" ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        _tr_print_log_line "$line"
    done < "$log_file"
}

task_run() {
    local name="$1"; shift
    local hint="" cmd=() status=0 idx
    while [ $# -gt 0 ]; do
        case "$1" in
            --hint) hint="$2"; shift 2 ;;
            *)      cmd+=("$1"); shift ;;
        esac
    done

    task_notice "$name: starting"
    "${cmd[@]}" >"$_TR_LOGDIR/$name.log" 2>&1 || status=$?

    if idx=$(_tr_index_of "$name"); then
        _TR_HINTS[$idx]="$hint"
        _TR_STATUS[$idx]=$([ "$status" -eq 0 ] && printf ok || printf fail)
        _TR_AWAITED[$idx]=false
    else
        _TR_NAMES+=("$name")
        _TR_HINTS+=("$hint")
        _TR_STATUS+=($([ "$status" -eq 0 ] && printf ok || printf fail))
        _TR_AWAITED+=(false)
    fi
    return 0
}

task_await() {
    local name="$1" idx
    if ! idx=$(_tr_index_of "$name"); then
        echo "task_await: no task named '$name'" >&2
        return 0
    fi
    if [ "${_TR_AWAITED[$idx]}" = true ]; then
        return 0
    fi

    _TR_AWAITED[$idx]=true
    _section "$name"
    _tr_print_log "$_TR_LOGDIR/$name.log"

    if [ "${_TR_STATUS[$idx]}" = "fail" ]; then
        _TR_FAILED+=("$name")
        local hint="${_TR_HINTS[$idx]}"
        if [ -n "$hint" ]; then
            "$hint" "$_TR_LOGDIR/$name.log"
        fi
    fi
    return 0
}

task_skip() {
    local name="$1" reason="$2" idx
    if idx=$(_tr_index_of "$name"); then
        _TR_STATUS[$idx]="skip"
        _TR_AWAITED[$idx]=true
    else
        _TR_NAMES+=("$name")
        _TR_HINTS+=("")
        _TR_STATUS+=("skip")
        _TR_AWAITED+=(true)
    fi
    _section "$name"
    task_warn "$reason"
}

task_succeeded() {
    local idx
    idx=$(_tr_index_of "$1") || return 1
    [ "${_TR_STATUS[$idx]}" = "ok" ]
}

task_summary() {
    if [ "${#_TR_FAILED[@]}" -gt 0 ]; then
        _section "Failed"
        local name
        for name in "${_TR_FAILED[@]}"; do
            printf '  %s-%s %s\n' "$_TR_COLOR_RED" "$_TR_COLOR_RESET" "$name"
        done
        return 1
    fi
    _section "Done"
    return 0
}
