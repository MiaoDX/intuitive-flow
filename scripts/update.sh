#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REQUIRE_NO_RUNNING_CODEX=false
UPDATE_LOCK_DIR="${TMPDIR:-/tmp}/intuitive-flow-update.lock.d"
UPDATE_LOCK_PID_FILE="$UPDATE_LOCK_DIR/pid"
UPDATE_LOCK_HELD=false
NPM_REGISTRY_MODE="${NPM_REGISTRY_MODE:-direct}"

usage() {
    echo "Usage: ${0##*/} [--require-no-running-codex] [--skip-codex-running-check] [--npm-mirror]"
}

codex_running_hint() {
    echo "Hint: Rerun without --require-no-running-codex to warn about running Codex sessions and continue."
}

print_npm_source() {
    case "$NPM_REGISTRY_MODE" in
        direct)
            if declare -F task_success >/dev/null 2>&1; then
                task_success "npm registry mode: direct ($NPM_FALLBACK_REGISTRY)"
            else
                echo "  ✓ npm registry mode: direct ($NPM_FALLBACK_REGISTRY)"
            fi
            ;;
        mirror)
            if declare -F task_success >/dev/null 2>&1; then
                task_success "npm registry mode: mirror ($NPM_MIRROR_REGISTRY)"
            else
                echo "  ✓ npm registry mode: mirror ($NPM_MIRROR_REGISTRY)"
            fi
            ;;
        *)
            if declare -F task_warn >/dev/null 2>&1; then
                task_warn "unknown NPM_REGISTRY_MODE=$NPM_REGISTRY_MODE; using direct registry"
            else
                echo "  ! unknown NPM_REGISTRY_MODE=$NPM_REGISTRY_MODE; using direct registry"
            fi
            NPM_REGISTRY_MODE=direct
            ;;
    esac
}

cleanup_update_lock() {
    [ "$UPDATE_LOCK_HELD" = true ] || return 0
    [ "$(cat "$UPDATE_LOCK_PID_FILE" 2>/dev/null || true)" = "$$" ] || return 0
    rm -rf "$UPDATE_LOCK_DIR"
}

update_lock_pid_is_active() {
    local pid="$1"
    local project_dir cwd command

    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    [ "$pid" != "$$" ] || return 1
    [ "$pid" != "${BASHPID:-}" ] || return 1
    [ -d "/proc/$pid" ] || return 1

    project_dir=$(cd "$SCRIPT_DIR/.." && pwd)
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
    [ "$cwd" = "$project_dir" ] || return 1

    command=$(ps -o command= -p "$pid" 2>/dev/null || true)
    [[ "$command" == *"/bin/bash "*"scripts/update.sh"* || "$command" == bash\ *"scripts/update.sh"* ]]
}

acquire_update_lock() {
    local lock_pid

    if mkdir "$UPDATE_LOCK_DIR" 2>/dev/null; then
        printf '%s\n' "$$" > "$UPDATE_LOCK_PID_FILE"
        UPDATE_LOCK_HELD=true
        trap cleanup_update_lock EXIT
        return 0
    fi

    lock_pid=$(cat "$UPDATE_LOCK_PID_FILE" 2>/dev/null || true)
    if update_lock_pid_is_active "$lock_pid"; then
        echo "Another update.sh run is already active:"
        ps -o pid=,etime=,command= -p "$lock_pid"
        exit 1
    fi

    echo "  ! removing stale update lock: $UPDATE_LOCK_DIR"
    rm -rf "$UPDATE_LOCK_DIR"
    if ! mkdir "$UPDATE_LOCK_DIR" 2>/dev/null; then
        echo "Another update.sh run may have started."
        echo "Inspect it with:"
        echo "  ps -eo pid,ppid,pgid,etime,command | grep '[s]cripts/update.sh'"
        exit 1
    fi

    printf '%s\n' "$$" > "$UPDATE_LOCK_PID_FILE"
    UPDATE_LOCK_HELD=true
    trap cleanup_update_lock EXIT
}

for arg in "$@"; do
    case "$arg" in
        --require-no-running-codex)
            REQUIRE_NO_RUNNING_CODEX=true
            ;;
        --skip-codex-running-check)
            REQUIRE_NO_RUNNING_CODEX=false
            ;;
        --npm-mirror)
            NPM_REGISTRY_MODE=mirror
            ;;
        --no-npm-mirror)
            NPM_REGISTRY_MODE=direct
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $arg" >&2
            usage >&2
            exit 2
            ;;
    esac
done

source "$SCRIPT_DIR/lib/npm-registry.sh"
export NPM_REGISTRY_MODE

acquire_update_lock

# Source nvm if available (needed when running from bash but nvm is configured in zsh)
if [ -n "${NVM_DIR:-}" ] && [ -f "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    # Activate node if not in PATH (e.g., default version was uninstalled)
    if ! command -v node >/dev/null 2>&1; then
        nvm use --lts >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
    fi
fi

source "$SCRIPT_DIR/lib/ensure-no-running-codex.sh"
source "$SCRIPT_DIR/lib/ensure-clean-env.sh"
source "$SCRIPT_DIR/lib/task-runner.sh"
source "$SCRIPT_DIR/tasks/update-cli.sh"
source "$SCRIPT_DIR/tasks/update-gsd-workflow.sh"
source "$SCRIPT_DIR/tasks/update-skills.sh"
source "$SCRIPT_DIR/tasks/update-gstack.sh"
source "$SCRIPT_DIR/tasks/sync-local-commands-skills.sh"

TASK_RUNNER_EXTRA_CLEANUP=cleanup_update_lock

task_init
print_npm_source

ensure_clean_env
if [ "$REQUIRE_NO_RUNNING_CODEX" = true ]; then
    task_warn "Requiring no running Codex sessions before update."
    if ! ensure_no_running_codex; then
        echo
        usage
        codex_running_hint
        exit 1
    fi
else
    warn_if_codex_running
fi

# ── Update phases ────────────────────────────────────────────────────
#
# These tasks mutate global npm packages, ~/.claude, ~/.codex, ~/.agents,
# and vendored skill checkouts. Run them sequentially so installers do not
# contend for npm cache, global package trees, or agent config files.
task_run "Global CLI tools" run_global_cli_tools --hint print_npm_failure_hint
task_await "Global CLI tools"

task_run "GSD workflow" run_gsd_workflow
task_await "GSD workflow"

if task_succeeded "Global CLI tools"; then
    task_run "MCP: fetch" run_mcp_fetch
    task_await "MCP: fetch"

    task_run "Claude plugins" run_claude_plugins
    task_await "Claude plugins"
else
    task_skip "MCP: fetch"     "skipped because Global CLI tools failed"
    task_skip "Claude plugins" "skipped because Global CLI tools failed"
fi

if task_succeeded "Global CLI tools"; then
    task_run "Codex config" run_codex_config
    task_await "Codex config"
else
    task_skip "Codex config" "skipped because Global CLI tools failed"
fi

if task_succeeded "Global CLI tools"; then
    task_run "GStack" run_gstack --hint print_gstack_failure_hint
    task_await "GStack"
else
    task_skip "GStack" "skipped because Global CLI tools failed"
fi

# GSD scans ~/.codex/skills, and GStack rewrites the gstack skill links there.
# Keep those phases ahead of the remaining skill installers so home-level skill
# updates do not overlap.
external_skill_labels=$(list_external_skill_labels)
for agent in claude-code codex; do
    while IFS= read -r label; do
        [ -n "$label" ] || continue
        n="External skills: $label -> $agent"; task_run "$n" run_external_skill_label "$agent" "$label"; task_await "$n"
    done <<< "$external_skill_labels"
done
n="External skills: prune removed labels"; task_run "$n" prune_removed_external_skill_labels; task_await "$n"

# Local command/skill sync also writes to ~/.codex/skills. Run it last so local
# skill overrides win deterministically.
task_run "Repo-local commands & skills" run_sync_local_commands_skills
task_await "Repo-local commands & skills"

task_summary
