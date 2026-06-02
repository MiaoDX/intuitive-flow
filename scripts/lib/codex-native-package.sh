#!/bin/bash

# Codex publishes platform-native binaries through optional dependency aliases:
#   @openai/codex-linux-x64 -> npm:@openai/codex@<version>-linux-x64
# Keep this validation separate from registry selection so direct and mirror
# checks stay readable.

codex_native_package_name() {
    node - <<'NODE'
const cpu = process.arch
let platformKey = null

if (process.platform === 'linux') {
  platformKey = `linux-${cpu}`
} else if (process.platform === 'darwin') {
  platformKey = `darwin-${cpu}`
} else if (process.platform === 'win32') {
  platformKey = `win32-${cpu}`
}

if (platformKey) {
  console.log(`@openai/codex-${platformKey}`)
}
NODE
}

codex_native_dependency_spec() {
    local registry="$1"
    local codex_version native_name optional_dependencies

    native_name=$(codex_native_package_name)
    [ -n "$native_name" ] || return 1

    codex_version=$(npm_package_version @openai/codex "$registry") || return 1
    [ -n "$codex_version" ] || return 1

    optional_dependencies=$(npm_package_field_json "@openai/codex@$codex_version" optionalDependencies "$registry") || return 1
    NATIVE_NAME="$native_name" node -e '
const nativeName = process.env.NATIVE_NAME
let optionalDependencies

try {
  optionalDependencies = JSON.parse(require("fs").readFileSync(0, "utf8"))
} catch {
  process.exit(1)
}

const spec = optionalDependencies?.[nativeName]
if (!spec) process.exit(1)
console.log(spec)
' <<< "$optional_dependencies"
}

codex_native_package_version() {
    local registry="$1"
    local native_spec native_version

    native_spec=$(codex_native_dependency_spec "$registry") || return 1
    native_version="${native_spec#npm:@openai/codex@}"
    [ "$native_version" != "$native_spec" ] || return 1
    printf '%s\n' "$native_version"
}

codex_native_dist_tag_version() {
    local registry="$1"
    local native_name

    native_name=$(codex_native_package_name)
    [ -n "$native_name" ] || return 1

    npm_package_field_json @openai/codex dist-tags "$registry" | NATIVE_NAME="$native_name" node -e '
const nativeName = process.env.NATIVE_NAME
const tag = nativeName.replace("@openai/codex-", "")
let distTags

try {
  distTags = JSON.parse(require("fs").readFileSync(0, "utf8"))
} catch {
  process.exit(1)
}

const version = distTags?.[tag]
if (!version) process.exit(1)
console.log(version)
'
}

codex_native_package_available() {
    local registry="$1"
    local native_name native_version tag_value

    native_name=$(codex_native_package_name)
    [ -n "$native_name" ] || return 0

    native_version=$(codex_native_package_version "$registry") || return 1
    tag_value=$(codex_native_dist_tag_version "$registry") || return 1
    [ "$tag_value" = "$native_version" ]
}

npm_registry_has_required_native_packages() {
    local registry="$1"
    shift

    local package
    for package in "$@"; do
        if [ "$package" = "@openai/codex" ] && ! codex_native_package_available "$registry"; then
            npm_registry_warn "Codex native package is unavailable from registry: $registry"
            return 1
        fi
    done
}
