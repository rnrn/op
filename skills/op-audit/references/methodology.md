# op-audit Skill — Methodology & Ledger Schema

Reference material for the `op-audit` skill. Loaded on demand; not part of the SKILL body.

## Why multi-agent, and the run order

A flat single-pass scan mixes risk classes and produces "technical impressions," not
investor-grade findings. This skill follows a managed contour:

```
Scope freeze  ->  Audit (lanes in parallel)  ->  Verify (adversarial, pipelined)
              ->  Investor-Risk scoring (deterministic)  ->  Synthesize exec pack
```

- **Lanes run in parallel**, each reading the real modules it owns and citing `file:line`.
- **Verification is pipelined into the audit**: each lane's High/Critical findings are
  re-checked by an independent skeptic the moment that lane finishes (no global barrier).
  A finding the verifier refutes never reaches the report.
- **Scoring is deterministic code, not an LLM** — removes variance from the number that
  drives prioritization.
- **Synthesis runs last, only over survived findings.**

## The seven default lanes

| Key | Lane |
|---|---|
| `appsec-secrets` | Secret & crypto core (crown jewel — keys, KDF, AEAD, redaction) |
| `appsec-surface` | Network-exposed surfaces + auth (endpoints, SSRF, leakage, DoS controls) |
| `architecture` | Modularity, coupling, cycles, god-objects, SPOFs, blast radius |
| `supplychain` | Deps, SBOM, container images, licenses, provenance |
| `quality` | Oversized files, complexity, duplication, dead code, error handling |
| `cicd` | Required checks, scanned artifact, pinning, secret hygiene, release controls |
| `testing` | Test pyramid + critical-path coverage, negative/regression/fuzz gaps |
| `perf-sre` | Concurrency safety, streaming/backpressure, hot paths, observability maturity |

Lanes auto-discover their own files; pass `lanes:[{key,label,hint,paths}]` in `args` to
focus or trim them for a given project.

## Investor Risk Score

```
Investor Risk (0-10) = 0.25·TechnicalSeverity + 0.20·Exploitability + 0.20·AssetCriticality
                     + 0.15·Exposure + 0.10·BlastRadius + 0.10·RemediationDifficulty
```

Each dimension is scored 0–10 by the auditing agent. Findings rank by final (post-verification)
severity, then by this score. This makes architecture/quality/perf issues directly comparable
to security issues on one scale. It is a reporting model, not a standard.

## Ledger schema — `audit-findings.json`

```json
{
  "meta":   { "module": "<name>", "generated": "<YYYY-MM-DD>", "method": "audit skill" },
  "scope":  { "loc": 0, "packages": 0, "files": 0 },
  "severity_counts": { "Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Note": 0 },
  "status_counts":   { "open": 0, "in_progress": 0, "fixed": 0, "verified": 0, "wont_fix": 0, "regressed": 0 },
  "total_open_person_days": 0,
  "findings": [
    {
      "id": "SEC-CRYPTO-01",
      "domain": "appsec-secrets",
      "title": "…",
      "location": "path/to/file.go:120",
      "severity": "High",
      "investor_risk_score": 7.0,
      "confidence": "proven | probable | tentative",
      "observation": "objective fact found in code",
      "why_it_matters": "technical + business impact",
      "remediation": "minimal sufficient fix",
      "effort_days": 3,
      "dimensions": { "technical_severity": 0, "exploitability": 0, "asset_criticality": 0,
                       "exposure": 0, "blast_radius": 0, "remediation_difficulty": 0 },
      "status": "open",
      "first_seen": "2026-06-16",
      "last_checked": "2026-06-16",
      "verification": { "verdict": "confirmed", "materiality": "material",
                         "rationale": "…", "evidence": "file:line re-read" },
      "task_ref": ""
    }
  ]
}
```

### Status lifecycle

| Status | Meaning | Set by |
|---|---|---|
| `open` | confirmed, not started | run (new finding) |
| `in_progress` | being worked / partially fixed | manual, or `verify` → partially-fixed |
| `fixed` | believed resolved, not yet re-verified | run auto-resolve, or manual |
| `verified` | re-checked by an agent, resolution confirmed | `verify` → fixed |
| `wont_fix` | accepted risk | `close --reason` |
| `regressed` | was fixed/verified, reappeared in a later run | run merge |

### Merge rule (the reason re-runs are cheap and safe)

On `run`, match returned findings to the prior ledger **by `id`**. Carry over `status`,
`first_seen`, and `task_ref` for matches; never reset a `verified`/`wont_fix` finding to
`open` just because an auditor re-described it. A prior open finding that is absent from
the new run becomes a `fixed` candidate — confirm with `verify <ID>` before trusting it.
Stable IDs come from the auditor's semantic id and from passing prior IDs back in as
`knownFindings` so the agents reuse them.

## beads task export

```bash
bd create --batch tasks.md          # one issue per finding from generated markdown
bd list --label audit --status open # walk open audit tasks
bd note <id> "verified fixed @ file:line (audit verify)"
bd close <id>
```

Map severity → priority (Critical/High → high, Medium → medium, Low/Note → low). Store the
returned `bd` id in the finding's `task_ref`. For findings with an obvious prerequisite,
`bd link` them so the tracker reflects remediation order.
