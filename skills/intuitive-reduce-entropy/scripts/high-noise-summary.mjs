#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const BASE_SURFACES = [
  '.planning',
  'docs/plans',
  'tasks',
  '.scratch',
  'tmp',
  'output',
  'logs',
  'log',
  'docs/generated',
  'specs',
  'tests',
  'test',
  'profiles',
]

function parseArgs(argv) {
  const options = {
    examples: 6,
    json: false,
    surfaces: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--examples') {
      const value = Number(argv[i + 1])
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--examples must be a positive number')
      }
      options.examples = Math.min(Math.floor(value), 20)
      i += 1
    } else if (arg === '--surface') {
      const value = argv[i + 1]
      if (!value) {
        throw new Error('--surface needs a path')
      }
      options.surfaces.push(cleanSurface(value))
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.surfaces.length === 0) {
    options.surfaces = defaultSurfaces()
  }

  return options
}

function cleanSurface(value) {
  return String(value).replace(/^\.\/+/, '').replace(/\/+$/, '')
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 1024 * 1024,
  })
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim())
  }
  return result
}

function splitNul(text) {
  return text.split('\0').filter(Boolean)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function trackedFiles() {
  const result = runGit(['ls-files', '-z'], { allowFailure: true, maxBuffer: 2 * 1024 * 1024 })
  return splitNul(result.stdout || '')
}

function profileSurfacesFromTrackedFiles() {
  const surfaces = []

  for (const file of trackedFiles()) {
    const parts = file.split('/')
    const index = parts.lastIndexOf('profiles')
    if (index >= 0) {
      surfaces.push(parts.slice(0, index + 1).join('/'))
    }
  }

  return unique(surfaces).slice(0, 12)
}

function defaultSurfaces() {
  return unique([...BASE_SURFACES, ...profileSurfacesFromTrackedFiles()])
}

function sample(values, limit) {
  return values.slice(0, limit)
}

function truncate(value, maxLength = 220) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

function renderList(values) {
  return values.map((value) => truncate(value)).join(', ')
}

function listTracked(surface) {
  const result = runGit(['ls-files', '-z', '--', surface], { allowFailure: true })
  return splitNul(result.stdout || '')
}

function listUntracked(surface) {
  const result = runGit(['ls-files', '--others', '--exclude-standard', '-z', '--', surface], {
    allowFailure: true,
  })
  return splitNul(result.stdout || '')
}

function listTopEntries(surface, limit) {
  if (!existsSync(surface)) {
    return []
  }

  const stats = statSync(surface)
  if (!stats.isDirectory()) {
    return [surface]
  }

  return readdirSync(surface)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
    .map((entry) => join(surface, entry).replace(/\\/g, '/'))
}

function referenceSamples(surface, limit) {
  const tokens = [...new Set([surface, basename(surface)].filter(Boolean))]
  const samples = []

  for (const token of tokens) {
    const result = runGit(['grep', '-n', '-F', token, '--', '.'], {
      allowFailure: true,
      maxBuffer: 512 * 1024,
    })
    const lines = (result.stdout || '')
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.startsWith(`${surface}/`) && !line.startsWith(`${surface}:`))

    for (const line of lines) {
      if (!samples.includes(line)) {
        samples.push(line)
      }
      if (samples.length >= limit) {
        return samples
      }
    }
  }

  return samples
}

function summarizeSurface(surface, examples) {
  const tracked = listTracked(surface)
  const untracked = listUntracked(surface)
  const topEntries = listTopEntries(surface, examples)
  const refs = referenceSamples(surface, examples)

  return {
    surface,
    exists: existsSync(surface),
    tracked_count: tracked.length,
    untracked_count: untracked.length,
    top_entries_sample: sample(topEntries, examples),
    tracked_sample: sample(tracked, examples),
    untracked_sample: sample(untracked, examples),
    reference_sample_count: refs.length,
    reference_samples: sample(refs, examples),
    budget_note:
      refs.length > 0 || tracked.length > 0
        ? 'Deep-read only the files needed to prove a candidate.'
        : 'Park as local/no-live-reference residue unless another probe makes it live.',
  }
}

function renderMarkdown(summary) {
  const lines = [
    '# High-Noise Surface Summary',
    '',
    `Examples per list: ${summary.examples}`,
    '',
  ]

  for (const surface of summary.surfaces) {
    lines.push(`## ${surface.surface}`)
    lines.push(
      `exists=${surface.exists} tracked=${surface.tracked_count} untracked=${surface.untracked_count} reference_samples=${surface.reference_sample_count}`,
    )
    lines.push(`budget: ${surface.budget_note}`)

    if (surface.top_entries_sample.length > 0) {
      lines.push(`top entries: ${renderList(surface.top_entries_sample)}`)
    }
    if (surface.tracked_sample.length > 0) {
      lines.push(`tracked sample: ${renderList(surface.tracked_sample)}`)
    }
    if (surface.untracked_sample.length > 0) {
      lines.push(`untracked sample: ${renderList(surface.untracked_sample)}`)
    }
    if (surface.reference_samples.length > 0) {
      lines.push('reference samples:')
      for (const ref of surface.reference_samples) {
        lines.push(`- ${truncate(ref)}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function usage() {
  return `Usage: high-noise-summary.mjs [--json] [--examples N] [--surface path ...]

Summarize high-noise repo surfaces without printing long historical/generated
file lists. Run from the target repository root.`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const summary = {
    examples: options.examples,
    surfaces: options.surfaces.map((surface) => summarizeSurface(surface, options.examples)),
  }

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(renderMarkdown(summary))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
