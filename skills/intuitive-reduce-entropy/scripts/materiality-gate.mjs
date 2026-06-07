#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

const ELIGIBLE_REASONS = new Set([
  'false_confidence',
  'live_source_drift',
  'stale_surface',
  'real_workflow_friction',
  'recurring_rediscovery',
])

const SUPPORT_ONLY_REASONS = new Set([
  'wording_polish',
  'punctuation',
  'formatting',
  'ordering',
  'numbering',
  'aesthetic_neatness',
  'test_only_support',
  'doc_only_support',
])

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(normalizeToken).filter(Boolean)
  const token = normalizeToken(value)
  return token ? [token] : []
}

function candidateId(candidate, index) {
  return candidate.id || candidate.title || `candidate_${index + 1}`
}

function evaluateCandidate(candidate, index) {
  const id = candidateId(candidate, index)
  const materiality = normalizeList(candidate.materiality ?? candidate.materiality_reasons)
  const eligible = materiality.filter((reason) => ELIGIBLE_REASONS.has(reason))
  const supportOnly = materiality.filter((reason) => SUPPORT_ONLY_REASONS.has(reason))
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.filter(Boolean) : []
  const parent = candidate.parent_candidate ?? candidate.parentCandidate
  const errors = []
  const warnings = []

  if (eligible.length === 0) {
    errors.push(`${id}: missing eligible materiality reason`)
  }

  if (supportOnly.length > 0 && eligible.length === 0) {
    errors.push(`${id}: support/polish-only work should not be counted as an entropy group`)
  } else if (supportOnly.length > 0) {
    warnings.push(`${id}: includes support-only reasons; merge with parent slice unless independently material`)
  }

  if (evidence.length === 0) {
    errors.push(`${id}: missing repo evidence`)
  }

  if (parent && eligible.length === 0) {
    errors.push(`${id}: supporting work should be grouped under ${parent}`)
  }

  return {
    id,
    status: errors.length === 0 ? 'eligible' : 'reject',
    eligible_reasons: eligible,
    errors,
    warnings,
  }
}

export function evaluate(payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  const requestedGroups = Number(payload.requested_groups ?? payload.requestedGroups ?? candidates.length)
  const candidateResults = candidates.map(evaluateCandidate)
  const eligible = candidateResults.filter((candidate) => candidate.status === 'eligible')
  const errors = candidateResults.flatMap((candidate) => candidate.errors)
  const warnings = candidateResults.flatMap((candidate) => candidate.warnings)
  const quotaSaturated = Number.isFinite(requestedGroups) && requestedGroups > eligible.length

  if (candidates.length === 0) {
    errors.push('no candidates supplied')
  }

  if (quotaSaturated) {
    warnings.push(
      `requested ${requestedGroups} group(s), but only ${eligible.length} candidate(s) pass materiality; treat the request as a maximum, not a quota`,
    )
  }

  return {
    ok: errors.length === 0,
    stop_recommended: eligible.length === 0,
    quota_saturated: quotaSaturated,
    requested_groups: Number.isFinite(requestedGroups) ? requestedGroups : null,
    eligible_count: eligible.length,
    rejected_count: candidateResults.length - eligible.length,
    errors,
    warnings,
    candidates: candidateResults,
  }
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: materiality-gate.mjs <candidates.json>')
    process.exit(2)
  }

  const payload = JSON.parse(await readFile(inputPath, 'utf8'))
  const result = evaluate(payload)
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
