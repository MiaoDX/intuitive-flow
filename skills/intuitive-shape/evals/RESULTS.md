# Initial Paired Evaluation

Date: 2026-08-24

## Setup

- Four representative prompts were run in fresh read-only agent sessions.
- Baseline sessions were explicitly prevented from reading the skill.
- Treatment sessions read `SKILL.md` and `references/shaped-bet-contract.md`,
  but not eval cases, expected outputs, or the rubric.
- One fresh judge read only `RUBRIC.md` and anonymized response pairs.
- A/B labels were independently swapped across cases before judging.
- One additional fresh session converted the CSV shaped bet through
  `$intuitive-preflight` to test handoff preservation.

## Blinded Scores

| Case | Skill | Baseline | Material difference |
| --- | ---: | ---: | --- |
| Two-week import grab bag | 100.0% | 78.6% | Added ordered cuts and a week-one circuit breaker |
| Competitor-driven auth rewrite | 100.0% | 66.7% | Stopped at a one-week non-production research bet |
| One-of-three cycle bet | 100.0% | 57.1% | Made a bounded commitment instead of a reversible ranking |
| Five-day AI assistant grab bag | 100.0% | 50.0% | Removed broad automation and stopped before task planning |

Mean: skill `100.0%`; baseline `63.1%`; relative improvement `58.5%`.
The initial run passes the rubric's 20% paired-improvement threshold.

## Handoff Proof

The preflight conversion preserved:

- the two-week appetite as an execution ceiling;
- CSV-only no-gos as non-goals and expansion triggers;
- the ordered cut policy while protecting the core flow;
- the week-one circuit breaker as a stop-and-reshape condition;
- the original `RESHAPE` decision rather than treating excluded sources as
  deferred architecture requirements.

The generated preflight suggested a `.planning/` path instead of this repo's
default `docs/plans/` convention. That is a downstream route-selection issue,
not a shaped-bet information-loss issue.

## Judgment

Keep the skill registered on demand and experimental. The first run shows a
material decision-quality signal, especially on grab bags and stop conditions,
but does not yet justify making the skill a default public route.

Before promotion, repeat with different models or independent runs, include the
two unused eval cases, and use a second blinded judge on verbatim outputs.

## Limitations

- One model family produced baseline, treatment, and judge outputs.
- Each prompt had one baseline and one treatment sample.
- The judge received faithful condensed responses rather than full verbatim
  transcripts.
- The prompts were synthetic and do not establish external adoption, naming,
  discoverability, or GitHub-star demand.
