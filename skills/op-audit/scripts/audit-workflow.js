// Generic investor-grade audit engine. Invoked via the Workflow tool with a
// scriptPath pointing here. Project specifics arrive through `args` (the skill
// discovers them live), so this engine ships no project assumptions.
//
//   args = {
//     root:      "<repo root absolute path>",
//     baseline:  "<the project's OWN security/coding standards, discovered from",
//                " AGENTS.md / CLAUDE.md / docs — used as the audit yardstick>",
//     mode:      "audit" (default) | "verify",
//     lanes:     optional [{key,label,hint}] to override/trim the default 7 lanes,
//     findings:  (verify mode) [{id,title,location,remediation,severity}] to re-check,
//     knownFindings: (audit mode) [{id,title,location}] so auditors REUSE stable ids,
//   }
//
// Returns (audit mode): {scope?, sevCounts, totalEffort, domainSummaries, findings[], synthesis}
// Returns (verify mode): {resolutions:[{finding_id, resolution, evidence, notes}]}

export const meta = {
  name: 'investor-audit',
  description: 'Multi-lane investor-grade technical due-diligence: domain auditors -> adversarial verification -> Investor-Risk scoring -> synthesis. Verify-mode re-checks specific findings without re-auditing.',
  phases: [
    { title: 'Audit', detail: 'domain auditors over discovered modules, evidence-backed findings' },
    { title: 'Verify', detail: 'adversarial verification of High/Critical findings' },
    { title: 'Synthesize', detail: 'Investor-Risk scoring + executive pack' },
  ],
}

const A = args || {}
const ROOT = A.root || '.'
const BASELINE_PROJECT = (A.baseline || '').trim()
// Stance: 'project' (discovery, whole codebase) | 'charter' (scoped to A.paths, serves a plan).
const SCOPE = A.scope === 'charter' ? 'charter' : 'project'
const PATHS = (A.paths || '').trim()
const SCOPE_CLAUSE = SCOPE === 'charter' && PATHS
  ? `SCOPED AUDIT (charter): audit ONLY this changed surface against the plan — do NOT scan, discover, or report issues elsewhere in the project: ${PATHS}. Read those files and produce structured findings now.`
  : `Discover the relevant files under ${ROOT}, read them, and produce structured findings now.`

const BASELINE = `
You are an INDEPENDENT third-party auditor producing INVESTOR-GRADE technical due-diligence on the
codebase rooted at ${ROOT}. Read REAL files with your tools (use absolute paths). Cite evidence as file:line.
Be rigorous and skeptical; report only what you can prove from the code. Separate observed fact from
interpretation. Report genuine STRENGTHS too (investors need balance). Note what you could NOT cover.

PROJECT-DECLARED STANDARDS (use as the audit yardstick — violations are findings):
${BASELINE_PROJECT || '(none discovered — apply general secure-SDLC + language idiom baselines)'}

For EACH finding fill the six dimensions (0-10) honestly — they drive the Investor Risk Score:
technical_severity, exploitability, asset_criticality, exposure, blast_radius, remediation_difficulty.`

// Tier policy embedded verbatim — canonical: scripts/lib/fan-out-lane.mjs ("fan-out-lane:v1").
// Read-only lanes (auditors, verifiers) → cheap model; the write-grade synthesis lane →
// capable. A cheap auditor that under-scopes (no result) self-escalates ONCE to capable.
// Tier ids arrive via `args` (aliased A) — the Workflow sandbox has no `process` (env would throw).
// The skill resolves OP_FANOUT_* in-session and forwards {cheapModel, capableModel} in args.
const laneModel = (kind) => (kind === 'write' ? (A.capableModel || undefined) : (A.cheapModel || 'haiku'))

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['domain', 'scope_units', 'summary', 'findings', 'strengths', 'coverage_notes', 'escalate'],
  properties: {
    escalate: { type: 'boolean', description: 'set true if this lane could not adequately cover its scope at the current model tier (under-scope) — a more capable model will re-run it once (fan-out-lane:v1 contract)' },
    domain: { type: 'string' },
    scope_units: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: '3-6 sentence domain verdict for a CTO/investor' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'scope_unit', 'location', 'observation', 'why_it_matters', 'severity', 'dimensions', 'confidence', 'remediation', 'effort_days', 'needs_human_review'],
        properties: {
          id: { type: 'string', description: 'stable id e.g. SEC-CRYPTO-01; REUSE an existing id if this is the same issue' },
          title: { type: 'string' },
          scope_unit: { type: 'string' },
          location: { type: 'string', description: 'file:line / endpoint / config key' },
          observation: { type: 'string' },
          why_it_matters: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Note'] },
          dimensions: {
            type: 'object', additionalProperties: false,
            required: ['technical_severity', 'exploitability', 'asset_criticality', 'exposure', 'blast_radius', 'remediation_difficulty'],
            properties: {
              technical_severity: { type: 'number' }, exploitability: { type: 'number' },
              asset_criticality: { type: 'number' }, exposure: { type: 'number' },
              blast_radius: { type: 'number' }, remediation_difficulty: { type: 'number' },
            },
          },
          confidence: { type: 'string', enum: ['proven', 'probable', 'tentative'] },
          remediation: { type: 'string' },
          effort_days: { type: 'number' },
          needs_human_review: { type: 'boolean' },
        },
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    coverage_notes: { type: 'string' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['finding_id', 'verdict', 'rationale', 'adjusted_severity', 'investor_materiality', 'evidence_checked'],
  properties: {
    finding_id: { type: 'string' },
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'needs-more-info', 'duplicate'] },
    rationale: { type: 'string' },
    adjusted_severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Note'] },
    investor_materiality: { type: 'string', enum: ['deal-blocking', 'material', 'minor', 'none'] },
    evidence_checked: { type: 'string' },
  },
}

const RESOLUTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['finding_id', 'resolution', 'evidence', 'notes'],
  properties: {
    finding_id: { type: 'string' },
    resolution: { type: 'string', enum: ['fixed', 'partially-fixed', 'still-open', 'cannot-tell'] },
    evidence: { type: 'string', description: 'the file:line you re-read to decide' },
    notes: { type: 'string' },
  },
}

const DEFAULT_LANES = [
  { key: 'appsec-secrets', label: 'AppSec: secret & crypto core (crown jewel)',
    hint: 'Find and read the secret/credential/crypto/key-management code. Verify: key material never on disk/env/argv/logs; correct AEAD use (no nonce reuse, auth-tag verified); KDF/derivation; secret file perms; constant-time compares; redaction. This is the highest investor-materiality surface.' },
  { key: 'appsec-surface', label: 'AppSec: network-exposed surfaces + auth',
    hint: 'Find and read every network-exposed handler/endpoint/admin surface. Verify: all public endpoints authenticate; credentials validated against a known value (constant-time, not mere presence); SSRF / injection / header-leak in outbound calls; request body preserved across retries; CORS/TLS/session/cookie security; rate-limit/circuit-breaker as DoS controls; no secret leakage in errors.' },
  { key: 'architecture', label: 'Architecture: modularity, coupling, boundaries',
    hint: 'Map the components. Find: layer erosion, import cycles, god-packages / god-objects, shared mutable global state, single points of failure, blast radius on change. Judge whether it absorbs team + load + integration growth without a rewrite.' },
  { key: 'supplychain', label: 'Supply chain: deps, SBOM, containers, licenses',
    hint: 'Inventory direct + transitive deps from manifests/lockfiles; flag known-vuln/unpinned/abandoned packages. Assess any SBOM freshness/completeness. Audit container images: base pinned by digest, nonroot, no secrets in layers, minimal surface, healthcheck, multi-stage. Check LICENSE presence + dependency license inventory + provenance/signing/SLSA evidence. Classify each issue security / licensing / operational.' },
  { key: 'quality', label: 'Code quality & maintainability',
    hint: 'In the largest/riskiest packages: oversized files (vs project budget), high-complexity functions, duplication, dead code, inconsistent error handling, ignored errors, missing test seams, naming smells. Quantify hotspots where change cost is disproportionate and bus-factor risk.' },
  { key: 'cicd', label: 'CI/CD & release controls',
    hint: 'Read CI configs, build/release scripts, commit/pre-commit gates, guard scripts. Assess: required checks (lint/test/race/vuln), is the ARTIFACT THAT SHIPS actually scanned, action/dependency pinning, secret hygiene, release/rollback + version traceability, branch protection signals, quality-gate coverage on new code. Note discipline-dependent (bypassable) controls vs enforced gates.' },
  { key: 'testing', label: 'Test sufficiency & critical-path coverage',
    hint: 'Quantity != adequacy. Assess the test pyramid; critically assess COVERAGE OF CRITICAL PATHS (auth boundary, crypto/secret delivery, core data plane, config). Find: critical paths with thin/no tests, happy-path bias, flaky patterns (real sleeps/time/network), missing negative/security/regression tests, fuzz gaps. Name the single highest-risk under-tested critical path.' },
  { key: 'perf-sre', label: 'Performance, concurrency & observability',
    hint: 'Assess concurrency safety (context propagation, client reuse, server timeouts, no sleeps in handlers, bounded goroutines, no data races on shared state), streaming/backpressure, hot-path allocations, N+1, cache correctness, and observability maturity (traces/metrics/logs/alerts/SLOs/profiling). Judge scalability headroom before money-relevant bottlenecks.' },
]

function riskScore(d) {
  if (!d) return 0
  return Number((0.25 * d.technical_severity + 0.20 * d.exploitability + 0.20 * d.asset_criticality +
    0.15 * d.exposure + 0.10 * d.blast_radius + 0.10 * d.remediation_difficulty).toFixed(2))
}
const SEV_RANK = { Critical: 5, High: 4, Medium: 3, Low: 2, Note: 1 }

// ----------------------------------------------------------------------------
// VERIFY MODE: re-check specific known findings for resolution. Cheap, targeted.
// ----------------------------------------------------------------------------
if (A.mode === 'verify') {
  const targets = A.findings || []
  phase('Verify')
  log(`Re-checking ${targets.length} finding(s) for resolution (no full re-audit).`)
  const resolutions = await parallel(
    targets.map((f) => () =>
      agent(
        `${BASELINE}\n\nRole: REMEDIATION VERIFIER. The finding below was reported in a previous audit. Open the cited location NOW, re-read the surrounding code, and decide whether it has been REMEDIATED in the current tree. Be strict: "fixed" requires the code to actually address the root cause, not merely look different. If you cannot reach the code or it is ambiguous, say cannot-tell.\n\nFINDING ${f.id}: ${f.title}\nLOCATION: ${f.location}\nWHAT-WAS-WRONG: ${f.observation || ''}\nEXPECTED-FIX: ${f.remediation || ''}`,
        { label: `recheck:${f.id}`, phase: 'Verify', model: laneModel('read'), schema: RESOLUTION_SCHEMA }
      ).then((r) => (r ? { ...r, finding_id: f.id } : { finding_id: f.id, resolution: 'cannot-tell', evidence: '', notes: 'verifier produced no result' }))
    )
  )
  return { resolutions: resolutions.filter(Boolean) }
}

// ----------------------------------------------------------------------------
// AUDIT MODE: full multi-lane audit -> verify -> score -> synthesize.
// ----------------------------------------------------------------------------
const lanes = (A.lanes && A.lanes.length ? A.lanes : DEFAULT_LANES)
const knownNote = (A.knownFindings && A.knownFindings.length)
  ? `\n\nEXISTING FINDING IDS (reuse the SAME id when you re-report the same underlying issue, so tracking stays stable):\n${A.knownFindings.map((k) => `- ${k.id}: ${k.title} @ ${k.location}`).join('\n')}`
  : ''

phase('Audit')
log(`Dispatching ${lanes.length} domain auditors over ${ROOT}.`)

const auditLane = async (d) => {
  const prompt = `${BASELINE}\n\nLANE: ${d.label}\n${d.hint}${d.paths ? `\nFocus modules: ${d.paths}` : ''}${knownNote}\n\n${SCOPE_CLAUSE} If this lane's scope is larger than you can audit thoroughly at your current capability, set "escalate": true (a more capable model re-runs it once); otherwise set it false.`
  let r = await agent(prompt, { label: `audit:${d.key}`, phase: 'Audit', model: laneModel('read'), schema: FINDINGS_SCHEMA })
  // self-escalate ONCE on the fan-out-lane:v1 contract: an explicit under-scope signal
  // (escalate:true) OR a dead/no-result lane re-runs on the capable model.
  if (!r || r.escalate === true) r = await agent(prompt, { label: `audit:${d.key}:escalate`, phase: 'Audit', model: laneModel('write'), schema: FINDINGS_SCHEMA })
  return r
}

const perDomain = await pipeline(
  lanes,
  (d) => auditLane(d),
  (audit, d) => {
    if (!audit) return { domain: d.key, label: d.label, audit: null, verdicts: [] }
    const toVerify = (audit.findings || []).filter((f) => f.severity === 'Critical' || f.severity === 'High')
    if (!toVerify.length) return { domain: d.key, label: d.label, audit, verdicts: [] }
    return parallel(
      toVerify.map((f) => () =>
        agent(
          `${BASELINE}\n\nRole: SENIOR INDEPENDENT VERIFIER (human-review layer). Adversarially verify the finding below: open the cited location, re-read the code, try to REFUTE it. Confirm only if the code truly supports it. Adjust severity if over/under-stated. Judge investor materiality (deal-blocking | material | minor | none). Default to skepticism on thin evidence.\n\nid=${f.id}\ntitle=${f.title}\nlocation=${f.location}\nseverity=${f.severity}\nobservation=${f.observation}\nwhy=${f.why_it_matters}`,
          { label: `verify:${f.id}`, phase: 'Verify', model: laneModel('read'), schema: VERDICT_SCHEMA }
        ).then((v) => (v ? { ...v, finding_id: f.id } : null))
      )
    ).then((vs) => ({ domain: d.key, label: d.label, audit, verdicts: vs.filter(Boolean) }))
  }
)

const allFindings = []
const domainSummaries = []
let totalEffort = 0
for (const r of perDomain.filter(Boolean)) {
  if (!r.audit) { domainSummaries.push({ domain: r.domain, label: r.label, summary: '(auditor produced no result)', findings: 0, strengths: [], coverage: '' }); continue }
  const vById = {}
  for (const v of r.verdicts) vById[v.finding_id] = v
  for (const f of r.audit.findings || []) {
    const v = vById[f.id]
    if (v && v.verdict === 'refuted') continue
    totalEffort += Number(f.effort_days || 0)
    allFindings.push({
      ...f, domain: r.domain, domain_label: r.label,
      final_severity: (v && v.adjusted_severity) ? v.adjusted_severity : f.severity,
      investor_risk_score: riskScore(f.dimensions),
      verification: v ? { verdict: v.verdict, materiality: v.investor_materiality, rationale: v.rationale, evidence: v.evidence_checked } : { verdict: 'unverified', materiality: '', rationale: '', evidence: '' },
    })
  }
  domainSummaries.push({ domain: r.domain, label: r.label, summary: r.audit.summary, scope_units: r.audit.scope_units || [], findings: (r.audit.findings || []).length, strengths: r.audit.strengths || [], coverage: r.audit.coverage_notes || '' })
}

allFindings.sort((a, b) => (SEV_RANK[b.final_severity] - SEV_RANK[a.final_severity]) || (b.investor_risk_score - a.investor_risk_score))
const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0, Note: 0 }
for (const f of allFindings) sevCounts[f.final_severity] = (sevCounts[f.final_severity] || 0) + 1
const topRisks = allFindings.filter((f) => f.final_severity === 'Critical' || f.final_severity === 'High').slice(0, 12)
log(`Audit complete: ${allFindings.length} findings (C:${sevCounts.Critical} H:${sevCounts.High} M:${sevCounts.Medium} L:${sevCounts.Low} N:${sevCounts.Note}). Synthesizing.`)

phase('Synthesize')
const synthesis = await agent(
  `${BASELINE}\n\nRole: AUDIT ORCHESTRATOR producing the INVESTOR EXECUTIVE PACK from the verified, risk-scored findings below. Board-ready, honest, balanced (cite strengths). Do NOT invent findings; you may group/theme them.\n\nDOMAIN SUMMARIES:\n${JSON.stringify(domainSummaries)}\n\nTOP RISKS (scored 0-10):\n${JSON.stringify(topRisks.map((f) => ({ id: f.id, domain: f.domain, sev: f.final_severity, score: f.investor_risk_score, title: f.title, why: f.why_it_matters, materiality: f.verification.materiality, effort_days: f.effort_days })))}\n\nSeverity counts: ${JSON.stringify(sevCounts)}. Total remediation: ~${totalEffort} person-days.`,
  {
    label: 'synthesize:exec-pack', phase: 'Synthesize', model: laneModel('write'),
    schema: {
      type: 'object', additionalProperties: false,
      required: ['overall_rating', 'overall_assessment', 'top_findings_narrative', 'architecture_resilience', 'security_and_compliance', 'delivery_maturity', 'remediation_economics', 'deal_implication', 'remediation_waves'],
      properties: {
        overall_rating: { type: 'string' }, overall_assessment: { type: 'string' },
        top_findings_narrative: { type: 'string' }, architecture_resilience: { type: 'string' },
        security_and_compliance: { type: 'string' }, delivery_maturity: { type: 'string' },
        remediation_economics: { type: 'string' }, deal_implication: { type: 'string' },
        remediation_waves: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            required: ['wave', 'theme', 'items', 'effort_days'],
            properties: {
              wave: { type: 'string', enum: ['Wave 1 — quick wins', 'Wave 2 — hardening', 'Wave 3 — structural'] },
              theme: { type: 'string' }, items: { type: 'array', items: { type: 'string' } }, effort_days: { type: 'number' },
            },
          },
        },
      },
    },
  }
)

return { sevCounts, totalEffort, domainSummaries, findings: allFindings, synthesis }
