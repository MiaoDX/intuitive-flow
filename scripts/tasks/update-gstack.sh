#!/bin/bash

if ! declare -F task_notice >/dev/null 2>&1; then
    task_notice() { :; }
fi

# Failure hint for run_gstack — surfaces the case where the install path
# exists but is not a git checkout (typical when the directory was created
# manually or left behind from a different tool).
print_gstack_failure_hint() {
    local log_file="$1"
    local repo_dir

    repo_dir=$(sed -n 's/^gstack install path exists but is not a git repo: //p' "$log_file" | tail -1)

    if [ -n "$repo_dir" ]; then
        echo "  ! That path already exists but is not a gstack git checkout:"
        echo "    $repo_dir"
        echo "  ! Move it aside or rerun update.sh with GSTACK_REPO_DIR pointing at a clean checkout path."
    fi
}

run_gstack() {
    local project_dir repo_dir repo_parent

    project_dir=$(cd "$SCRIPT_DIR/.." && pwd)
    repo_dir="${GSTACK_REPO_DIR:-$project_dir/vendor/gstack}"

    if ! command -v git >/dev/null 2>&1; then
        echo "  ! skipped because git is not installed"
        return 0
    fi

    if ! command -v bun >/dev/null 2>&1; then
        echo "  ! skipped because bun is not installed (gstack requires Bun)"
        return 0
    fi

    repo_parent=$(dirname "$repo_dir")
    mkdir -p "$repo_parent"

    if [ -e "$repo_dir" ]; then
        if ! git -C "$repo_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            echo "gstack install path exists but is not a git repo: $repo_dir"
            return 1
        fi

        task_notice "GStack: pulling $repo_dir"
        git -C "$repo_dir" pull --ff-only -q
    else
        task_notice "GStack: cloning https://github.com/garrytan/gstack.git"
        git clone --single-branch --depth 1 -q https://github.com/garrytan/gstack.git "$repo_dir"
    fi

    # Run explicit host installs so both Claude Code and Codex get the gstack skill set.
    # Suppress verbose output; only show errors.
    (
        cd "$repo_dir"
        task_notice "GStack: installing Claude host"
        ./setup --host claude -q >/dev/null 2>&1
        task_notice "GStack: installing Codex host"
        ./setup --host codex -q >/dev/null 2>&1
    ) || {
        echo "  ! gstack setup failed"
        return 1
    }

    bun "$SCRIPT_DIR/lib/managed-skill-state.ts" gstack-sync "$repo_dir" "$SCRIPT_DIR/default-skill-allowlist.txt" || return 1

    echo "  ✓ gstack latest"
    echo "  ✓ gstack path: $repo_dir"
    echo "  ✓ gstack hosts: claude, codex"
}

run_gstack_state() {
    local state_dir state_remote sync_pull branch origin_url

    state_dir="${GSTACK_STATE_DIR:-$HOME/.gstack}"
    state_remote="${GSTACK_STATE_REPO_URL:-}"
    sync_pull="$state_dir/sync-pull"

    if ! command -v git >/dev/null 2>&1; then
        echo "  ! skipped because git is not installed"
        return 0
    fi

    if [ -d "$state_dir" ] && git -C "$state_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if [ -f "$sync_pull" ]; then
            task_notice "GStack State: running $sync_pull"
            (cd "$state_dir" && bash "$sync_pull" >/dev/null 2>&1) || true
        else
            if ! git -C "$state_dir" remote get-url origin >/dev/null 2>&1; then
                echo "  ! skipped because $state_dir has no origin remote"
                return 0
            fi

            branch="$(git -C "$state_dir" branch --show-current 2>/dev/null || echo main)"
            if ! git -C "$state_dir" rev-parse --verify "@{upstream}" >/dev/null 2>&1; then
                if ! git -C "$state_dir" rev-parse --verify "refs/remotes/origin/$branch" >/dev/null 2>&1; then
                    task_notice "GStack State: fetching origin $branch"
                    git -C "$state_dir" fetch origin "$branch" >/dev/null 2>&1 || true
                fi
                if git -C "$state_dir" rev-parse --verify "refs/remotes/origin/$branch" >/dev/null 2>&1; then
                    git -C "$state_dir" branch --set-upstream-to="origin/$branch" "$branch" >/dev/null 2>&1 || true
                fi
            fi

            task_notice "GStack State: pulling $state_dir"
            git -C "$state_dir" pull --rebase --autostash -q
        fi

        origin_url="$(git -C "$state_dir" remote get-url origin 2>/dev/null || true)"
        echo "  ✓ gstack state synced"
        echo "  ✓ gstack state path: $state_dir"
        if [ -n "$origin_url" ]; then
            echo "  ✓ gstack state origin: $origin_url"
        fi
        return 0
    fi

    if [ -e "$state_dir" ]; then
        echo "  ! skipped because $state_dir exists but is not a git repo"
        echo "  ! Convert it with ~/.gstack/sync-init or clone your private state repo into that path."
        return 0
    fi

    if [ -z "$state_remote" ]; then
        echo "  ! skipped because $state_dir does not exist and GSTACK_STATE_REPO_URL is not set"
        return 0
    fi

    mkdir -p "$(dirname "$state_dir")"
    task_notice "GStack State: cloning $state_remote"
    git clone --single-branch --depth 1 -q "$state_remote" "$state_dir"
    chmod +x "$state_dir"/sync-* 2>/dev/null || true

    if [ -f "$sync_pull" ]; then
        task_notice "GStack State: running $sync_pull"
        (cd "$state_dir" && bash "$sync_pull" >/dev/null 2>&1) || true
    fi

    echo "  ✓ gstack state cloned"
    echo "  ✓ gstack state path: $state_dir"
    echo "  ✓ gstack state origin: $state_remote"
}
