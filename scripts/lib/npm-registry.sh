#!/bin/bash

NPM_MIRROR_REGISTRY="${NPM_MIRROR_REGISTRY:-https://registry.npmmirror.com}"
NPM_FALLBACK_REGISTRY="${NPM_FALLBACK_REGISTRY:-https://registry.npmjs.org}"
NPM_REGISTRY_MODE="${NPM_REGISTRY_MODE:-direct}"

npm_registry_notice() {
    local message="$*"

    if declare -F task_notice >/dev/null 2>&1; then
        task_notice "$message"
    elif [[ "${TASK_NOTICE_FD:-}" =~ ^[0-9]+$ ]]; then
        { printf '  → %s\n' "$message" >&"$TASK_NOTICE_FD"; } 2>/dev/null || true
    fi
}

npm_registry_warn() {
    local message="$*"

    if declare -F task_warn >/dev/null 2>&1; then
        task_warn "$message" >&2
    else
        echo "  ! $message" >&2
    fi
}

npm_package_available() {
    local package="$1"
    local registry="$2"

    npm_package_version "$package" "$registry" >/dev/null 2>&1
}

npm_package_version() {
    local package="$1"
    local registry="$2"

    npm view "$package" version --registry="$registry" 2>/dev/null | tail -1
}

npm_package_field_json() {
    local package="$1"
    local field="$2"
    local registry="$3"

    npm view "$package" "$field" --json --registry="$registry" 2>/dev/null
}

global_npm_package_version() {
    local package="$1"
    local tree

    tree=$(npm ls -g "$package" --json --depth=10 2>/dev/null) || true
    [ -n "$tree" ] || return 1

    PACKAGE_NAME="$package" node -e '
const target = process.env.PACKAGE_NAME
let root

try {
  root = JSON.parse(require("fs").readFileSync(0, "utf8"))
} catch {
  process.exit(1)
}

function findPackage(node, name) {
  if (!node?.dependencies) return null

  for (const [depName, dep] of Object.entries(node.dependencies)) {
    if (depName === name && dep?.version) return dep.version

    const nested = findPackage(dep, name)
    if (nested) return nested
  }

  return null
}

const version = findPackage(root, target)
if (!version) process.exit(1)
console.log(version)
' <<< "$tree"
}

_NPM_REGISTRY_LIB_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$_NPM_REGISTRY_LIB_DIR/codex-native-package.sh"
unset _NPM_REGISTRY_LIB_DIR

select_npm_registry() {
    local purpose="$1"
    shift

    if [ "$NPM_REGISTRY_MODE" = "direct" ]; then
        npm_registry_notice "$purpose: checking npm registry $NPM_FALLBACK_REGISTRY"
        for package in "$@"; do
            if ! npm_package_available "$package" "$NPM_FALLBACK_REGISTRY"; then
                npm_registry_warn "$purpose package unavailable from npm registry: $package"
                return 1
            fi
        done

        npm_registry_has_required_native_packages "$NPM_FALLBACK_REGISTRY" "$@" || return 1

        npm_registry_notice "$purpose: using npm registry $NPM_FALLBACK_REGISTRY"
        echo "  ✓ $purpose registry: $NPM_FALLBACK_REGISTRY" >&2
        printf '%s\n' "$NPM_FALLBACK_REGISTRY"
        return 0
    fi

    if [ "$NPM_REGISTRY_MODE" != "mirror" ]; then
        npm_registry_warn "unknown NPM_REGISTRY_MODE=$NPM_REGISTRY_MODE; expected direct or mirror"
        return 1
    fi

    local package missing=()
    for package in "$@"; do
        if ! npm_package_available "$package" "$NPM_MIRROR_REGISTRY"; then
            missing+=("$package")
        fi
    done

    if [ "${#missing[@]}" -eq 0 ] && npm_registry_has_required_native_packages "$NPM_MIRROR_REGISTRY" "$@"; then
        npm_registry_notice "$purpose: using mirror registry $NPM_MIRROR_REGISTRY"
        echo "  ✓ $purpose registry: $NPM_MIRROR_REGISTRY (--npm-mirror)" >&2
        printf '%s\n' "$NPM_MIRROR_REGISTRY"
        return 0
    fi

    if [ "${#missing[@]}" -gt 0 ]; then
        npm_registry_warn "$purpose mirror missing package(s): ${missing[*]}"
    else
        npm_registry_warn "$purpose mirror missing required native package(s)"
    fi
    return 1
}

claude_native_package() {
    node - <<'NODE'
function detectMusl() {
  if (process.platform !== 'linux') return false
  const report =
    typeof process.report?.getReport === 'function'
      ? process.report.getReport()
      : null
  return report != null && report.header?.glibcVersionRuntime === undefined
}

const cpu = process.arch
let platformKey = null

if (process.platform === 'linux') {
  platformKey = `linux-${cpu}${detectMusl() ? '-musl' : ''}`
} else if (process.platform === 'darwin') {
  platformKey = `darwin-${cpu}`
} else if (process.platform === 'win32') {
  platformKey = `win32-${cpu}`
}

if (platformKey) {
  console.log(`@anthropic-ai/claude-code-${platformKey}`)
}
NODE
}
