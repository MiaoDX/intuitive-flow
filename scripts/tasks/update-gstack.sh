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

    bun "$SCRIPT_DIR/lib/gstack-skill-state.ts" sync "$repo_dir" "$SCRIPT_DIR/default-skill-allowlist.txt" || return 1

    echo "  ✓ gstack latest"
    echo "  ✓ gstack path: $repo_dir"
    echo "  ✓ gstack hosts: claude, codex"
}
