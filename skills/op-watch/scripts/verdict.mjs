#!/usr/bin/env node
// op-watch — deterministic campaign verdict. Computes the outcome from the campaign
// STATE file (never the model's say-so), so a goal-loop driver can be fooled neither
// into stopping early NOR into running forever. Three outcomes:
//
//   CLEAN-DONE     exit 0  done:true   — >=1 unit, nothing active, nothing handed-off,
//                                        no dup ids, validate green (zero units is never DONE).
//   CLEAN-HANDOFF  exit 0  done:false  — loop must STOP but the campaign is NOT done:
//                                        active work remains but a breaker tripped
//                                        (budget-out · a unit hit 3 strikes · no net
//                                        progress over K steps), OR no active work
//                                        remains yet units are deferred/blocked/unknown
//                                        or validate is red. The agenda is surfaced.
//   CONTINUE       exit 1               — active work remains and no breaker tripped.
//
// Both CLEAN-* exit 0 so `goal` stops; the token + the `done:` line tell a wrapper
// whether the campaign actually finished or was handed to the human.
//
// Usage:
//   node verdict.mjs --state docs/.work/<slug>.json [--validate "<shell cmd>"]
//
// Status buckets:
//   active            = open | in_progress | fixed | built   -> keep looping (fixed/built
//                       are await-verify; a breaker may still trip)
//   terminal-resolved = verified | wont_fix | done
//   terminal-human    = blocked | deferred | deferred_validation   (surfaced, not active)
//
// Termination breakers (deterministic — read from state, not agent prose):
//   - budget:        budget.spent >= budget.total
//   - 3-strikes:     any ACTIVE unit with attempts >= strikes (default 3)
//   - no-progress:   over the last K history entries (default 3), resolved did not rise
//                    and active did not fall — AND every active unit has been tried (F-E).
//   - step-cap:      step/history count >= max_steps (default max(20, units*5)) (F-D).
//   - dup-ids:       any duplicate unit id (corrupt ledger; also refuses CLEAN-DONE) (F-H).

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const STATE = arg("state", "");
const VALIDATE = arg("validate", "");
if (!STATE) { console.error("VERDICT: ERROR — --state <campaign.json> required"); process.exit(2); }

let s;
try { s = JSON.parse(fs.readFileSync(STATE, "utf8")); }
catch (e) { console.error(`VERDICT: ERROR — cannot read ${STATE}: ${e.message}`); process.exit(2); }

const units = Array.isArray(s.units) ? s.units : [];
// "fixed"/"built" are await-verify: the fix/build landed but the teeth-verify step is
// still PENDING, so they keep the loop active (else a lone fixed unit would hand off
// before it is ever verified — found dogfooding on fast models, F-F).
const ACTIVE = new Set(["open", "in_progress", "fixed", "built"]);
const RESOLVED = new Set(["verified", "wont_fix", "done"]);
const HUMAN = new Set(["blocked", "deferred", "deferred_validation"]);

const active = units.filter((u) => ACTIVE.has(u.status));
const resolved = units.filter((u) => RESOLVED.has(u.status));
const human = units.filter((u) => HUMAN.has(u.status));
const unknown = units.filter((u) => !ACTIVE.has(u.status) && !RESOLVED.has(u.status) && !HUMAN.has(u.status));

// duplicate unit ids corrupt the active count and stall convergence (a hand-written
// ledger bug); surface them and refuse CLEAN-DONE so the loop repairs (validate-state --fix).
const ids = units.map((u) => u.id);
const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

// ── termination breakers ──────────────────────────────────────────────────────
const STRIKES = Number.isFinite(s.strikes) ? s.strikes : 3;
const stuck = active.filter((u) => (u.attempts || 0) >= STRIKES);

const budgetOut = !!(s.budget && s.budget.total != null && s.budget.spent != null && s.budget.spent >= s.budget.total);

const K = Number.isFinite(s.no_progress_k) ? s.no_progress_k : 3;
let noProgress = false;
// A flat window is a STALL only when every active unit has actually been tried.
// Units with attempts===0 (e.g. gate steps not yet dispatched) are pending forward
// work, not a stall — counting them would hand off a campaign that just hasn't
// reached its next step yet (found by dogfooding op-watch on fast models, F-E).
if (active.length > 0 && active.every((u) => (u.attempts || 0) > 0) && Array.isArray(s.history) && s.history.length >= K) {
  const recent = s.history.slice(-K);
  const first = recent[0], last = recent[recent.length - 1];
  const resolvedRose = (last.resolved ?? 0) > (first.resolved ?? 0);
  const activeFell = (last.active ?? 0) < (first.active ?? 0);
  // open→in_progress→built is real progress invisible to the active/resolved COUNTS (built ⊂ active).
  // mark.mjs records a per-unit status-rank sum `score`; a rising score means work advanced even if the
  // bucket counts are flat (e.g. building every unit before verifying any), so it is NOT a stall (F-S).
  // Backward-compatible: if the window lacks `score` (pre-F-S state), fall back to the count-only test.
  const scoreRose = first.score != null && last.score != null && last.score > first.score;
  noProgress = !resolvedRose && !activeFell && !scoreRose;
}

// absolute step-cap (F-D backstop): mark.mjs bumps `step`/`history` every step by
// SCRIPT, so this counter is honest independent of the model's say-so. Once a campaign
// has taken too many steps with work still active, hand off — guarantees termination of
// a productive-but-non-converging loop. Default scales with work size; `s.max_steps`
// (or --max-steps) overrides. (A spin that never calls mark records no step — that case
// is the goal driver's invocation cap; see SKILL "Resumability contract".)
const stepCount = Math.max(s.step || 0, Array.isArray(s.history) ? s.history.length : 0);
const argMax = Number(arg("max-steps", ""));
const MAX_STEPS = Number.isFinite(argMax) && argMax > 0 ? argMax
  : (Number.isFinite(s.max_steps) ? s.max_steps : Math.max(20, units.length * 5));
const stepCapHit = active.length > 0 && stepCount >= MAX_STEPS;

// campaign-level gates set by accept.mjs (open gate = NOT done, even with no active units):
//   gate_build           — a build/compile cmd failed (F-K functional gate)
//   gate_stack_undeclared — code files shipped with no declared stack, so the deviation guard is OFF (F-P)
const gateBlock = [];
if (s.gate_build) gateBlock.push("build");
if (s.gate_stack_undeclared) gateBlock.push("undeclared-stack");

const breakerNotes = [];
if (budgetOut) breakerNotes.push("budget-out");
if (stuck.length) breakerNotes.push(`3-strikes(${stuck.map((u) => u.id).slice(0, 6).join(",")})`);
if (noProgress) breakerNotes.push(`no-progress(${K})`);
if (stepCapHit) breakerNotes.push(`step-cap(${stepCount}/${MAX_STEPS})`);
if (dupIds.length) breakerNotes.push(`dup-ids(${dupIds.slice(0, 4).join(",")})`);
if (gateBlock.length) breakerNotes.push(`gate:${gateBlock.join("+")}`);
const breaker = budgetOut || stuck.length > 0 || noProgress || stepCapHit || dupIds.length > 0 || gateBlock.length > 0;

// optional independent re-check (e.g. validate:dist) — a red gate is not "done"
let validateOk = true, validateNote = "";
if (VALIDATE) {
  const r = spawnSync("bash", ["-lc", VALIDATE], { encoding: "utf8", timeout: 600000 });
  validateOk = r.status === 0;
  validateNote = validateOk ? "validate:ok" : `validate:FAILED(${r.status})`;
}

// surface handed-to-human + breaker-stuck + unknown explicitly (invariant 8)
for (const u of human) console.log(`  ${u.status.toUpperCase()}: ${u.id} ${u.title || u.segment || ""} ${u.notes ? "— " + u.notes : ""}`.trimEnd());
for (const u of stuck) console.log(`  STUCK: ${u.id} ${u.title || u.segment || ""} — ${u.attempts} attempts (≥${STRIKES} strikes); needs the user`.trimEnd());
if (unknown.length) console.log(`  ⚠ ${unknown.length} unit(s) in an unrecognized status: ${unknown.map((u) => u.id + ":" + u.status).slice(0, 6).join(", ")}`);
if (dupIds.length) console.log(`  ⚠ duplicate unit id(s): ${dupIds.slice(0, 6).join(", ")} — run validate-state.mjs --fix`);
if (gateBlock.includes("build")) console.log(`  ⚠ open gate: build — ${s.gate_build} (fix the build, then re-verify)`);
if (gateBlock.includes("undeclared-stack")) console.log("  ⚠ open gate: undeclared-stack — code shipped with no declared language; declare AGENTS.md Stack Profile `Language(s)` so the deviation guard runs");
if (units.length === 0) console.log("  ⚠ no recognized units — empty or non-contract state (op-watch expects a `units[]` array); NOT done");

// ── outcome ─────────────────────────────────────────────────────────────────
// units.length>0 is required for DONE: a state with zero recognized units (derive never
// populated it, or a non-contract schema like `stories` instead of `units`) is NOT
// vacuously complete — that would be a false CLEAN-DONE (F-J, found on north-mini-code-free).
const done = units.length > 0 && active.length === 0 && human.length === 0 && unknown.length === 0 && dupIds.length === 0 && validateOk && gateBlock.length === 0;
let outcome;
if (done) outcome = "CLEAN-DONE";
else if (active.length === 0 || breaker) outcome = "CLEAN-HANDOFF";
else outcome = "CONTINUE";

const summary = `units ${units.length} · active ${active.length} · resolved ${resolved.length} · handed-to-human ${human.length}` +
  (unknown.length ? ` · unknown ${unknown.length}` : "") + (VALIDATE ? ` · ${validateNote}` : "") +
  (breakerNotes.length ? ` · breaker:${breakerNotes.join("+")}` : "");

console.log(`VERDICT: ${outcome} — ${summary}`);
console.log(`done: ${done}`);
// exit 0 stops the goal loop (DONE or HANDOFF); exit 1 keeps it pumping (CONTINUE).
process.exit(outcome === "CONTINUE" ? 1 : 0);
