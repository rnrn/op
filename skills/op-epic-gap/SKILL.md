---
name: op-epic-gap
description: Draw an epic's target design against verified reality as one self-contained hand-drawn-style HTML — the design on the left, a numbered step trace on the right with every step marked exists / missing / partial, each mark backed by a claim ledger verified in code during the run. Use when the user asks to draw how it should be plus a trace of what is missing, when comparing a target architecture or epic plan against the current code, or when design questions (who decides, where does a step run) need answers pinned to verified facts. Generator — writes only the HTML artifact plus a throwaway check script (deleted after); never alters project code.
metadata:
  safety-class: generator
---

# Epic Gap Map

Produce ONE self-contained HTML file: the target design on the left, a numbered trace on the right where every step is marked exists / missing / partial — each mark backed by a fact verified in code DURING THIS RUN.

## Purpose

Primary: make the GAP between "how it should be" and "what is there" visible and falsifiable — every ✗ names the file (and line, when it is a specific site) where the gap bites. Secondary: answer the design questions the user asked, as sticky notes ON the canvas, so the artifact carries verdicts, not just topology. Explicitly NOT for: full backlog dumps or live task-chip maps (that is `runtime-map-updater`), doc-vs-code divergence reports (that is `op-drift-check`), or pretty posters without a claim ledger behind them.

## Safety Contract

Writes only the HTML artifact into the project's presentation directory
(`docs/presentations/` by default; use the directory the project declares or
the user names) and a throwaway verification script, deleted after the run
together with its screenshots. Never alter project code, never run `git add`,
`git commit`, or `git reset`. Reference images from the user set the STYLE,
never the content.

## Usage

```
/op-epic-gap <epic|design-doc|question> [--lang <code>]
```

**Artifact language:** by default the artifact speaks the language the project's
documentation is written in — detect it from the docs the ledger actually reads
(the epic/design/architecture files), not from a guess; `--lang <code>` (e.g.
`--lang en`, `--lang ru`) overrides the detection. The language applies to all
VISIBLE text — band labels, trace claims, sticky notes, legend, footer. It never
applies to the canonical layer: marks (✓/✗/◐), CSS class names (`.st.ok/.no/.part`),
file anchors, and evidence commands stay as-is, so the DOM parity check and any
tooling read every language version identically. Mixed-language doc corpora: use
the majority language and say so in the footer.

## Workflow

### 1. Facts before pixels

Build a claim ledger BEFORE any HTML: for every element that will carry an exists / missing / partial mark, run the grep / probe / live call that proves it NOW — never mark from memory or from a previous session's summary. Each ledger row: claim → evidence command → verdict (✓ exists / ✗ missing / ◐ partial) → anchor (`file:line` for a site, `file` for a module). A claim you could not verify is drawn as a labelled open question, never silently as either color.

### 2. Layout — two surfaces plus verdict notes

- Header: two dashed boxes — the TASK (what is being examined) and the key numbers or ground rules everything follows from.
- Left/center: the design. Group into labelled bands (e.g. AUTHORING / EXECUTION, or WHAT THE PLAN PROVIDES / WHAT CODE DECIDES). Existing mechanisms — solid boxes; missing ones — white boxes with a dashed red border and a `MISSING` tag. Wire causal flows with SVG arrows; label the wires.
- Right: the `.trace` panel — ONE concrete run/flow traced step by step. Each step: number, mark, one-line claim, an `<i>` anchor line with the evidence. The panel header carries the summary counts ("16 steps · 9 exist · 6 missing · 1 partial"). A bottom `.legend` states the single most important conclusion (e.g. "every gap sits between X and Y").
- Sticky notes (rotated, pink) answer the user's design questions with a verdict and its justification from the ledger — not neutrality. The trace's mark column adapts to the question (exists/missing, or who-decides: plan/code/model) — the method does not change.
- Mandatory legend mapping colors and styles to meaning, and an HTML comment `<!-- map-purpose: ... -->` naming the artifact's primary job (per the generator-purpose norm).

### 3. Hand-drawn recipe (the parts that make it read sketched)

- Font: `"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive`.
- Wobbly boxes: asymmetric `border-radius: 225px 14px 255px 14px/14px 225px 14px 255px` (mirror the two groups on `.alt` boxes so neighbours differ).
- Arrows: a single SVG overlay (`svg.wires`, `pointer-events: none`) with a `feTurbulence` + `feDisplacementMap` filter (baseFrequency ~0.02, scale ~2.4) on the stroke group — real line wobble, not faked curves; arrowheads via `marker` elements.
- Palette: blue `#a5d8ff/#1971c2`, green `#b2f2bb/#2f9e44` (exists), yellow `#ffec99/#f08c00` (attention), violet `#d0bfff/#6741d9` (model/LLM), pink `#ffc9c9/#e03131` (missing, notes). Ink `#1e1e1e`, paper white.
- Fixed-size `.stage` (~1690px wide); `body { overflow-x: auto }`. No external links, no CDN — the file must open by double-click, offline.

### 4. Verify the artifact (non-negotiable)

Run Playwright from wherever the project has it (its e2e directory, or `npx playwright` from the artifact's directory): load the file via `file:///`, assert zero `pageerror`, count the marked elements, screenshot — then READ the screenshot back and look at it: layout bugs (overlapping wires, labels colliding with headers) are only visible to eyes. Delete the check script and screenshots afterwards. When Playwright is unavailable on the host, the DOM count can run under plain `node` with a DOM shim, but the visual pass did NOT happen — say so and finish `DONE_WITH_CONCERNS`, never silently skip it.

**Parity check is mandatory:** the summary counts in the trace header MUST be computed from the DOM marks (`.st.no`, `.st.ok`, `.st.part`), never typed by hand. This rule exists because of a live failure: a hand-typed summary disagreed with the markup by one on each side.

### 5. Honest boundary

State in the footer where the facts came from (which files/probes) and the date. If a claim rests on a live probe of a running service, say so — a reader on another machine must know which marks could differ there. When the user asked a question the ledger cannot answer, the sticky note says that plainly.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, as plain text — no markdown emphasis or backticks around the token. An optional ` — <one-line reason>` may follow the token; nothing else. Do not invent other status wording:

- `DONE` — artifact written, every mark ledger-backed, DOM parity and the visual Playwright pass both green.
- `DONE_WITH_CONCERNS` — artifact written but something needs attention (visual pass unavailable, unverifiable claims drawn as open questions, live-probe-dependent marks); list it.
- `BLOCKED` — the claims cannot be verified (no repo access, probes cannot run) or the artifact cannot be written.
- `NEEDS_CONTEXT` — the target design or the flow to trace is not identifiable; name what is needed.
