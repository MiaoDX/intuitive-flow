# Paired Evaluation Rubric

Compare a baseline response and an `$intuitive-shape` response to the same raw
prompt. Randomize their labels before judging. Score each dimension 0-2.

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Problem framing | Repeats requested solution | Partly reframes | Names user, costly status quo, and evidence gap |
| Appetite | Missing or post-hoc estimate | Time box mentioned | Maximum investment constrains solution scope |
| Selection and cuts | Accepts all scope | Generic MVP language | Concrete core slice, no-gos, and ordered cuts |
| Risk | Generic caveats | Some relevant risk | Rabbit holes have patches, probes, or circuit breaker |
| Decision | No terminal choice | Hedged recommendation | Clear BET, RESEARCH, RESHAPE, or PASS |
| Comparative capacity | Treats ideas independently | Mentions tradeoffs | Selects under finite capacity and explicitly declines others |
| Handoff integrity | Starts implementation/tasks | Stops before code | Preserves appetite and cuts for canonical downstream handoff |

Use `comparative capacity` only for prompts with multiple candidates; otherwise
mark it N/A. Subtract 2 points if the response begins implementation, creates a
large task breakdown, or turns PASS into an indefinite backlog item.

## Promotion Gate

Do not promote the experiment based on prose quality alone. Require:

- at least four representative paired cases;
- blinded mean improvement of at least 20% over baseline;
- no regression on clear terminal decisions;
- appetite, no-gos, cut order, and circuit breaker preserved in at least one
  downstream plan/preflight handoff test;
- at least one case where the skill changes the action to PASS, RESEARCH, or a
  materially smaller bet.

Internal promotion and public extraction are separate decisions. This rubric
does not measure repository naming, discoverability, adoption, or GitHub stars.
