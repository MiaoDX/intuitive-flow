#!/bin/bash

_running_codex_rows() {
    local current_pid parent_pid

    current_pid=$$
    parent_pid=$PPID

    ps -eo pid=,tty=,command= |
        awk -v current_pid="$current_pid" -v parent_pid="$parent_pid" '
            /(^|[[:space:]])codex([[:space:]]|$)|\/codex([[:space:]]|$)/ && $1 != current_pid && $1 != parent_pid { print }
        '
}

ensure_no_running_codex() {
    local -a rows=()

    while IFS= read -r row; do
        rows+=("$row")
    done < <(_running_codex_rows)

    if [ "${#rows[@]}" -eq 0 ]; then
        return 0
    fi

    echo "  ! Refusing to update Codex config while Codex is already running."
    echo "  ! Older Codex sessions can rewrite ~/.codex/config.toml on exit and discard the new status line."
    echo "  ! Close these Codex sessions first, then rerun this script:"
    for row in "${rows[@]}"; do
        echo "    $row"
    done
    return 1
}

warn_if_codex_running() {
    local -a rows=()

    while IFS= read -r row; do
        rows+=("$row")
    done < <(_running_codex_rows)

    if [ "${#rows[@]}" -eq 0 ]; then
        return 0
    fi

    echo "  ! Codex is already running; continuing with update."
    echo "  ! Older Codex sessions can rewrite ~/.codex/config.toml on exit and discard the new status line."
    echo "  ! Restart already-running Codex sessions after update so config, hooks, and skills are refreshed."
    echo "  ! Running Codex sessions:"
    for row in "${rows[@]}"; do
        echo "    $row"
    done
    return 0
}
