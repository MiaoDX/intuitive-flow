#!/bin/bash
# Task runner for parallel install/sync orchestration.
#
# Owns: backgrounding, log capture, per-task hint dispatch, failure tally.
# Caller owns: the task list, phase ordering (when to await, when to gate).
#
# Vocabulary:
#   task_init                              — call once before scheduling tasks.
#   task_run NAME FN [args...] [--hint H]  — spawn FN in background, capture log.
#   task_await NAME                        — wait, print section, run hint on fail.
#   task_await_group GROUP NAME...         — wait for many; one section, merged log.
#   task_skip NAME REASON                  — mark skipped (e.g. upstream gate failed).
#   task_succeeded NAME                    — query last result; 0 iff status is "ok".
#   task_summary                           — print failed list; return 1 iff any failed.
#
# Implementation note: parallel arrays + linear lookup (bash 3.2 has no
# associative arrays). With ~10 tasks the linear scan is irrelevant.

_TR_NAMES=()    # task name in insertion order
_TR_PIDS=()     # pid (or empty after await)
_TR_HINTS=()    # hint fn name (or empty)
_TR_STATUS=()   # "ok" | "fail" | "skip" | ""  (empty = pending)
_TR_FAILED=()   # names that failed, for summary
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
        { printf '  %s→%s %s\n' "$_TR_COLOR_BLUE" "$_TR_COLOR_RESET" "$message" >&"$TASK_NOTICE_FD"; } 2>/dev/null || true
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

task_error() {
    local color="" reset=""
    if [ -t 1 ]; then
        color="$_TR_COLOR_RED"
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

_tr_pending_pids() {
    local pid
    for pid in "${_TR_PIDS[@]}"; do
        [ -n "$pid" ] || continue
        kill -0 "$pid" 2>/dev/null || continue
        printf '%s\n' "$pid"
    done
}

_tr_extra_cleanup() {
    local cleanup_fn="${TASK_RUNNER_EXTRA_CLEANUP:-}"

    [ -n "$cleanup_fn" ] || return 0
    declare -F "$cleanup_fn" >/dev/null 2>&1 || return 0
    "$cleanup_fn"
}

_tr_collect_descendants() {
    local parent="$1"
    local child

    for child in $(pgrep -P "$parent" 2>/dev/null || true); do
        _tr_collect_descendants "$child"
        printf '%s\n' "$child"
    done
}

_tr_kill_pending() {
    local pids=() kill_pids=() pid child

    while IFS= read -r pid; do
        pids+=("$pid")
        kill_pids+=("$pid")
    done < <(_tr_pending_pids)

    [ "${#pids[@]}" -gt 0 ] || return 0

    for pid in "${pids[@]}"; do
        while IFS= read -r child; do
            [ -n "$child" ] || continue
            kill_pids+=("$child")
        done < <(_tr_collect_descendants "$pid")
    done

    kill -TERM "${kill_pids[@]}" 2>/dev/null || true
    sleep 1

    for pid in "${kill_pids[@]}"; do
        kill -0 "$pid" 2>/dev/null || continue
        kill -KILL "$pid" 2>/dev/null || true
    done

    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
}

_tr_on_exit() {
    if [ "$_TR_CLEANING_UP" = true ]; then
        return 0
    fi

    _TR_CLEANING_UP=true
    _tr_kill_pending
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
    task_warn "interrupted by SIG$signal_name; terminating pending update task(s)"
    _tr_kill_pending
    _tr_extra_cleanup
    [ -n "${_TR_LOGDIR:-}" ] && rm -rf "$_TR_LOGDIR"
    exec 3>&- 2>/dev/null || true
    exit "$exit_code"
}

# _tr_index_of NAME — echo index of NAME in _TR_NAMES, return 1 if not found.
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
    printf '%s══ %s ══%s\n' "$_TR_COLOR_BOLD" "$1" "$_TR_COLOR_RESET"
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

# task_run NAME FN [args...] [--hint HINT_FN]
task_run() {
    local name="$1"; shift
    local hint="" cmd=()
    while [ $# -gt 0 ]; do
        case "$1" in
            --hint) hint="$2"; shift 2 ;;
            *)      cmd+=("$1"); shift ;;
        esac
    done

    task_notice "$name: starting"
    "${cmd[@]}" >"$_TR_LOGDIR/$name.log" 2>&1 &
    local pid=$!

    local idx
    if idx=$(_tr_index_of "$name"); then
        _TR_PIDS[$idx]="$pid"
        _TR_HINTS[$idx]="$hint"
        _TR_STATUS[$idx]=""
    else
        _TR_NAMES+=("$name")
        _TR_PIDS+=("$pid")
        _TR_HINTS+=("$hint")
        _TR_STATUS+=("")
    fi
}

# task_await NAME — always returns 0; caller queries via task_succeeded.
task_await() {
    local name="$1" idx
    if ! idx=$(_tr_index_of "$name"); then
        echo "task_await: no task named '$name'" >&2
        return 0
    fi
    local pid="${_TR_PIDS[$idx]}"
    if [ -z "$pid" ]; then
        echo "task_await: task '$name' has no pending pid" >&2
        return 0
    fi

    local status=0
    wait "$pid" || status=$?
    _TR_PIDS[$idx]=""

    _section "$name"
    _tr_print_log "$_TR_LOGDIR/$name.log"

    if [ "$status" -eq 0 ]; then
        _TR_STATUS[$idx]="ok"
    else
        _TR_STATUS[$idx]="fail"
        _TR_FAILED+=("$name")
        local hint="${_TR_HINTS[$idx]}"
        if [ -n "$hint" ]; then
            "$hint" "$_TR_LOGDIR/$name.log"
        fi
    fi
    return 0
}

# task_await_group GROUP NAME1 [NAME2...]
# Wait for many tasks, print one section under GROUP, merge their logs.
# If any failed, GROUP is recorded as the failure (not individual tasks).
task_await_group() {
    local group="$1"; shift
    local any_failed=false name idx pid status

    _section "$group"
    for name in "$@"; do
        if ! idx=$(_tr_index_of "$name"); then
            echo "  ! task_await_group: no task '$name'" >&2
            any_failed=true
            continue
        fi
        pid="${_TR_PIDS[$idx]}"
        if [ -z "$pid" ]; then
            echo "  ! task_await_group: task '$name' has no pending pid" >&2
            any_failed=true
            continue
        fi

        status=0
        wait "$pid" || status=$?
        _TR_PIDS[$idx]=""

        if [ "$status" -eq 0 ]; then
            _TR_STATUS[$idx]="ok"
        else
            _TR_STATUS[$idx]="fail"
            any_failed=true
        fi

        _tr_print_log "$_TR_LOGDIR/$name.log"
    done

    if $any_failed; then
        _TR_FAILED+=("$group")
    fi
    return 0
}

# task_skip NAME REASON — used when an upstream task failed.
task_skip() {
    local name="$1" reason="$2" idx
    if idx=$(_tr_index_of "$name"); then
        _TR_STATUS[$idx]="skip"
    else
        _TR_NAMES+=("$name")
        _TR_PIDS+=("")
        _TR_HINTS+=("")
        _TR_STATUS+=("skip")
    fi
    _section "$name"
    task_warn "$reason"
}

# task_succeeded NAME — return 0 iff the named task's status is "ok".
task_succeeded() {
    local idx
    idx=$(_tr_index_of "$1") || return 1
    [ "${_TR_STATUS[$idx]}" = "ok" ]
}

# task_summary — print failed-section list. Returns 1 iff any failed.
task_summary() {
    if [ "${#_TR_FAILED[@]}" -gt 0 ]; then
        _section "Failed ✗"
        local n
        for n in "${_TR_FAILED[@]}"; do
            printf '  %s-%s %s\n' "$_TR_COLOR_RED" "$_TR_COLOR_RESET" "$n"
        done
        return 1
    fi
    _section "Done ✓"
    return 0
}
