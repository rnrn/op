# Feedback Harvest — Duplicate Detection, File Mapping, Apply Validation

## Duplicate detection procedure

Before assigning `APPLY`, compare each candidate against existing
`docs/feedback/*.md` rules:

1. Search the target file and nearby rule files for the same nouns and verbs.
2. Check whether an existing rule already covers the same trigger, invariant,
   and preflight action.
3. If covered, mark:
   - `Status: DUPLICATE`
   - `Duplicate of: <file>#<rule-id>`
   - `Reason: <what existing rule already prevents>`
4. If the new candidate is narrower or stronger, mark `APPLY` only when it
   adds a distinct check or updates the existing rule instead of creating a
   parallel rule.
5. If unsure, mark `WATCH`, not `APPLY`.

Examples:

- "Named compose discovery must use materialized metadata" is duplicate of
  `runtime-resilience.md#Z8` when Z8 already exists.
- "Client launch must persist resolved defaults" is duplicate of
  `operator-journey.md#J7` when J7 already exists.
- "Responses fallback must preserve context" is duplicate of
  `execution-verification.md#E17` when E17 already covers stream/non-stream
  bridge parity.

## Suggested feedback files

Use existing project files first. The mapping below is illustrative, not a
required taxonomy — name files after the project's own failure domains (a GUI
project may want `ui-state.md`/`visual-regression.md`, an ML pipeline
`harness-validation.md`/`pipeline-changes.md`). Common mappings:

- planning and promotion gates: `phase-gates.md`
- implementation proof and regression evidence: `execution-verification.md`
- CLI/client/operator path: `operator-journey.md`
- saved config, provider resolution, vault binding: `config-sync.md`
- runtime lifecycle, health, stale processes: `runtime-resilience.md`
- deploy/container/secrets: `deploy-hardening.md`
- transport, proxy credentials, request boundaries: `transport-security.md`
- skills, prompts, agent workflow, orchestration: `rules-and-skills.md`
- baseline checks shared by all work: `baseline.md`

If the target file is missing, propose it in the checkpoint; create it only
with `--apply`.

## Apply-mode validation

After applying non-duplicate `APPLY` rules:

1. Update `docs/feedback/index.md` Quick Selector and priority/order if new
   files were added or rule ranges changed.
2. Keep the audit checkpoint; list exact files changed, skipped duplicates,
   and remaining watch items.
3. Lightweight validation: all linked feedback files exist; new rules include
   `Checklist (for preflight)` or sit under an existing checklist; no obvious
   secrets are present.
