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

const LOW_IMPACT_SCOPES = new Set([
  'single_file',
  'single_file_only',
  'metadata_only',
  'template_only',
  'route_index_only',
  'copy_only',
  'line_local',
])

const MICRO_WORK_TYPES = new Set([
  'metadata_consistency',
  'plan_state_only',
  'template_starter_only',
  'single_file_gate_extension',
  'isolated_doc_metadata',
  'cosmetic_symmetry',
  'wording_alignment',
])

const DEMAND_GATED_CHANGE_TYPES = new Set([
  'add_feature',
  'add_surface',
  'new_feature',
  'new_surface',
  'feature_addition',
  'surface_addition',
  'remove_feature',
  'remove_surface',
  'reduce_scope',
  'scope_reduction',
  'feature_removal',
  'surface_removal',
  'delete_feature',
  'delete_surface',
])

const WEAK_MAINTAINER_TERMS = [
  'consistency',
  'cleanup',
  'nice_to_have',
  'polish',
  'tidy',
  'neater',
  'aesthetic',
  'formatting',
]

const WEAK_DEMAND_TERMS = [
  'user_asked',
  'asked_for_it',
  'could_be_useful',
  'might_be_useful',
  'nice_to_have',
  'consistency',
  'cleanup',
  'polish',
  'tidy',
]

const IMPACT_RE =
  /\b(prevent|avoid|stop|unblock|catch|protect|remove|reduce|fix|fail|publish|trust|review|hide|mislead|drift|stale|broken|error|dead|rediscover)\b/i

const DEMAND_IMPACT_RE =
  /\b(reuse|narrow|document|delete|remove|replace|stale|mislead|unsupported|out[-_\s]?of[-_\s]?scope|scope|intent|value|workflow|surface|maintainer|agent|consumer|caller|drift|false[-_\s]?confidence|no[-_\s]?longer|cannot|keeping|kept)\b/i

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

function firstToken(...values) {
  for (const value of values) {
    const token = normalizeToken(value)
    if (token) return token
  }
  return ''
}

function hasBundledParent(candidate) {
  return Boolean(
    candidate.parent_candidate ??
      candidate.parentCandidate ??
      candidate.bundled_with ??
      candidate.bundledWith,
  )
}

function weakMaintainerTest(value) {
  const text = String(value ?? '').trim()
  if (!text) return true
  const token = normalizeToken(text)
  return WEAK_MAINTAINER_TERMS.some((term) => token.includes(term)) && !IMPACT_RE.test(text)
}

function weakDemandGate(value) {
  const text = String(value ?? '').trim()
  if (!text) return true
  const token = normalizeToken(text)
  return WEAK_DEMAND_TERMS.some((term) => token.includes(term)) && !DEMAND_IMPACT_RE.test(text)
}

function isOpenEndedLoop(payload) {
  const explicitValues = [
    payload.open_ended_loop,
    payload.openEndedLoop,
    payload.loop_mode,
    payload.loopMode,
    payload.mode,
    payload.goal_mode,
    payload.goalMode,
  ]

  if (explicitValues.some((value) => value === true)) return true

  const explicitTokens = explicitValues.map(normalizeToken)
  if (
    explicitTokens.some((token) =>
      ['open_ended', 'open_ended_loop', 'continuous', 'until_none', 'until_no_more', 'goal_loop'].includes(
        token,
      ),
    )
  ) {
    return true
  }

  const prompt = String(payload.prompt ?? payload.user_prompt ?? payload.userPrompt ?? '')
  return /持续|直至|不再有|continue until|keep reducing|until no|no more/i.test(prompt)
}

function evaluateCandidate(candidate, index, context = {}) {
  const id = candidateId(candidate, index)
  const severity = firstToken(candidate.severity, candidate.priority)
  const materiality = normalizeList(candidate.materiality ?? candidate.materiality_reasons)
  const eligible = materiality.filter((reason) => ELIGIBLE_REASONS.has(reason))
  const supportOnly = materiality.filter((reason) => SUPPORT_ONLY_REASONS.has(reason))
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.filter(Boolean) : []
  const parent = candidate.parent_candidate ?? candidate.parentCandidate
  const bundled = hasBundledParent(candidate)
  const impactRadius = firstToken(candidate.impact_radius, candidate.impactRadius, candidate.scope)
  const maintainerTest = candidate.maintainer_test ?? candidate.maintainerTest
  const workTypes = normalizeList(
    candidate.work_type ?? candidate.workType ?? candidate.change_type ?? candidate.changeType ?? candidate.category,
  )
  const changeTypes = normalizeList(candidate.change_type ?? candidate.changeType ?? candidate.work_type ?? candidate.workType)
  const demandGate = candidate.demand_gate ?? candidate.demandGate
  const needsDemandGate = changeTypes.some((type) => DEMAND_GATED_CHANGE_TYPES.has(type))
  const lowImpactScope = LOW_IMPACT_SCOPES.has(impactRadius)
  const microWork = workTypes.some((type) => MICRO_WORK_TYPES.has(type))
  const errors = []
  const warnings = []

  if (!severity) {
    errors.push(`${id}: missing severity`)
  }

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

  if (needsDemandGate) {
    if (!String(demandGate ?? '').trim()) {
      errors.push(`${id}: feature additions/removals need demand_gate explaining why the request itself should be done`)
    } else if (weakDemandGate(demandGate)) {
      errors.push(`${id}: demand_gate is too weak; justify the add/remove against reuse, narrowing, documentation, deletion, or keeping the behavior`)
    }
  }

  if (parent && eligible.length === 0) {
    errors.push(`${id}: supporting work should be grouped under ${parent}`)
  }

  if (severity === 'p2' && !bundled) {
    if (!impactRadius) {
      errors.push(`${id}: P2 candidates need impact_radius so the loop can distinguish material work from polish`)
    }

    if (!maintainerTest) {
      errors.push(`${id}: P2 candidates need maintainer_test explaining why this deserves standalone review`)
    } else if (weakMaintainerTest(maintainerTest)) {
      const message = `${id}: maintainer_test relies on weak cleanup language instead of concrete user/agent impact`
      if (context.openEndedLoop) errors.push(message)
      else warnings.push(message)
    }

    if (context.openEndedLoop && (lowImpactScope || microWork)) {
      errors.push(`${id}: isolated low-impact P2 work should be parked or bundled during open-ended reduce-entropy loops`)
    } else if (lowImpactScope || microWork) {
      warnings.push(`${id}: isolated low-impact P2 work should be bundled unless it has clear recurring impact`)
    }
  }

  return {
    id,
    status: errors.length === 0 ? 'eligible' : 'reject',
    severity: severity || null,
    eligible_reasons: eligible,
    errors,
    warnings,
  }
}

export function evaluate(payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  const requestedGroups = Number(payload.requested_groups ?? payload.requestedGroups ?? candidates.length)
  const openEndedLoop = isOpenEndedLoop(payload)
  const candidateResults = candidates.map((candidate, index) => evaluateCandidate(candidate, index, { openEndedLoop }))
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
    open_ended_loop: openEndedLoop,
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
