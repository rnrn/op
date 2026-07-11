# Runtime Map — Design Language

The visual language of the map artifact. The SKILL body carries only the machine-checked
interaction contract; **this file is the stated contract for how the map LOOKS** — read it before
creating a new map or restyling an existing one. The origin artifact was refined by hand over many
iterations; a fresh map built only to the validator's regexes reads as a wireframe. Everything a
polished map needs beyond the regexes is stated here (the F-V lesson: unstated intent is lost).

**Style in one sentence:** a dark marker-board — hand-drawn sketch on graph paper: irregular
borders, slight tilts, offset hard shadows, marker handwriting for headings, monospace for
technical labels, five restrained accent colors assigned by responsibility.

## Tokens

```css
:root {
  --ink: #f5f1df;        /* primary text — warm paper-white */
  --muted: #9d9b91;      /* secondary text */
  --board: #0b0d0d;      /* page background */
  --board-soft: #111514; /* raised surfaces (nodes, buttons) */
  --line: #343a37;       /* neutral borders */
  --mint: #57f0b2;  --gold: #ffd166;  --coral: #ff6f61;  --cyan: #65d6ff;  --violet: #c4a7ff;
  --shadow: rgba(0, 0, 0, 0.42);
  --ui: Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  --marker: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;  /* headings only */
}
```

Accent assignment is **by responsibility, not decoration** — e.g. mint = core flow/runtime,
gold = entry/interfaces, coral = boundaries/egress, cyan = data/observability, violet = platform.
Pick a mapping per project and keep it consistent across nodes, edges, legend, and panel accents
(`--node-color` on the node, `--detail-color` on its panel, `--edge-color` on its edges).

## Hand-drawn primitives (used everywhere)

- **Irregular border-radius** instead of uniform: `border-radius: 5px 8px 4px 7px` (cards),
  `50% 47% 53% 45%` (icon circles), `3px 6px 4px 5px` (buttons). Vary the numbers per component.
- **Slight rotation**: each node gets `--tilt` between −0.6deg and +0.6deg; stamps ±1.3–3deg;
  hover straightens to 0deg and lifts (`translateY(-2/-3px)`).
- **Offset hard shadows** (marker-on-board depth): `box-shadow: 5px 7px 0 rgba(0,0,0,.22)`,
  deepening on hover to `6px 9px 0 rgba(0,0,0,.32)`.
- **Marker stripe**: a short rotated `border-top: 2-3px solid <accent>` pseudo-element across a
  card's top-left (`width: ~34%; transform: rotate(-1.2deg)`) — the "highlighter swipe".
- **Dashed separators** (`1px dashed #353c37`) between sections, never solid heavy rules.

## Page & board

- `body`: graph-paper grid over the board color —
  `background: linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, same) var(--board); background-size: 28px 28px;`
- **Topbar**: eyebrow (mono, uppercase, `letter-spacing: .16em`, accent color, a small rotated
  dash `::before`), then `h1` in `--marker` at `clamp(30px, 4vw, 58px)`, then a muted subtitle.
- **Status stamp** top-right: 2px accent border, mono uppercase, `transform: rotate(1.3deg)`,
  offset shadow in the accent at ~18% alpha. Content = dated review scope, never a task count.
- **Board shell**: bordered container with a faint radial highlight
  (`radial-gradient(circle at 15% 12%, rgba(255,255,255,.028), transparent 20%)`), a deep drop
  shadow, and two **tape strips** — rotated semi-transparent beige rectangles
  (`rgba(220,207,165,.15)`, 64×18px) overlapping the top-left and bottom-right edges.
- **Layer labels** inside the board: absolute mono uppercase 9px labels naming each column/lane,
  with a short dashed underline `::after`.

## Nodes

Anatomy: topline (icon + step label) → `h2` title (marker font) → 1–2 line muted description →
optional mono tag row (dashed borders) or sub-rows (label + text on a dashed top border).

- Default state is **dimmed** (`opacity: .58`); hover/focus/selected → full opacity, accent
  border, straighten + lift; scenario-active → full opacity + accent-mixed border; scenario-inactive
  → `opacity: .2`. The board reads as a quiet sketch until the user engages.
- Icon: 28px irregular circle, accent border and letter/glyph in `--mono`, `rotate(-3deg)`.
- Step label: mono 9px uppercase in the accent (`01 · INTAKE` style).

## Edges

SVG paths under the nodes (`z-index` below cards), `stroke-linecap/join: round`:
- base: neutral `#4a514d`, 2.2px, `opacity: .28`; each edge has a **shadow twin** translated
  `(2px, 1px)` at `opacity: .12`;
- active (scenario highlight): accent stroke 3.2px, `stroke-dasharray: 10 8` with a slow
  `stroke-dashoffset` animation (`marker-flow`, ~1.2s linear infinite) — "marker being drawn";
- **edge labels**: mono 10px with a board-colored halo (`paint-order: stroke; stroke: var(--board);
  stroke-width: 5px`) so they stay legible over paths.
- Return/feedback flows route the perimeter and may use the coral accent.

## Scenario bar & notes

- Horizontal, scrollable if narrow; mono uppercase label first; buttons with irregular radius,
  neutral until hover (accent border), pressed = **filled** accent with dark text.
- **Fixed button order:** first — "Вся система" (`data-scenario="all"`), **selected on load**
  (`aria-pressed="true"`): every node and edge lit, nothing dimmed — the resting state of the
  board. Second — the gold-outlined all-tasks button. Route scenarios follow. Selecting a route
  narrows the view (untouched nodes dim to 0.2); re-clicking the active route returns to
  whole-system, never to an all-dimmed board.
- When a scenario is active, show a pinned **scenario note** (bottom-right of the board): a small
  annotation card with a 3px accent left border, mono text, accent-colored title line —
  one sentence on what the highlighted route (or the whole system) does.

## Detail panel (per node)

Right-docked, `min(800px, 50vw)` wide, `80vh` cap, vertically centered — the validator pins these.
Style on top of the contract:
- background repeats the ruled-paper motif (horizontal 28px lines over near-black), deep left
  shadow, irregular radius, subtle `rotate(.25deg)` that settles to 0 on open; marker stripe
  `::before` in `--detail-color` across the top-left.
- **Sticky header**: kicker (mono uppercase accent, e.g. layer/step), `h2` in marker font
  (`clamp(23px, 2vw, 32px)`), round close button that rotates 5deg and turns coral on hover.
- **Steps** (exactly three): ordered list with hand-drawn counter badges — 24px irregular circles,
  accent border and number, `rotate(-3deg)`.
- **Boundaries** (exactly three): a 3-column grid of items, each with a 2px accent left border,
  faint background, mono uppercase keyword + normal-case sentence.
- **Tasks**: heading row with a right-aligned mono annotation (review scope); rows = rotated
  priority pill (`P0`=coral `P1`=gold `P2`=cyan `P3`=violet, irregular radius, 1px current-color
  border) + text with a mono `small` reference line. Empty state = centered dashed box saying the
  block carries no verified open debt.
- Epic chips: pill-shaped (999px), mono; unselected = dark/dim, selected = **filled gold** with
  dark text.

## All-tasks dialog & tooltip

- Table `table-layout: fixed`; TH mono uppercase gold with a solid underline; task cell holds
  `strong` + mono `small`; blocks cell is a **borderless ellipsized trigger** (`cursor: help`,
  dashed cyan outline on focus).
- Tooltip: fixed-position card outside the scroll area, cyan border, irregular radius, one block
  per line, fades in with a 4px rise; `max-width: min(340px, calc(100vw - 24px))`.

## Motion & modes

- Load: nodes `draw-in` (fade + 8px rise, keeping their tilt) staggered ~40ms apart.
- Active edges animate dash offset; panels/backdrop fade-slide ~190ms.
- `@media (prefers-reduced-motion: reduce)` disables ALL of the above (animations and
  transitions), not just some.
- Mobile (≤760px): panel becomes a bottom sheet (`100vw`, `max-height: 80svh`, no horizontal
  overflow), board falls back to a simple grid, decorative layers (edges, tape, layer labels)
  may hide. Every text in panels/tables/tooltips stays ≥14px in all modes.

## Machine-checked minimum (do not regress)

The validator (`scripts/validate-runtime-map.mjs`) asserts the panel geometry tokens
(`--panel-width: min(800px, 50vw)`, `--panel-max-height: 80vh`, `top: 50%`,
`translate(28px, -50%)`, `scale(var(--panel-scale))`), the DPR zoom compensation
(`initialDevicePixelRatio / currentDevicePixelRatio`), the shared ids (`all-tasks-button`,
`epic-filters`, `all-tasks-body`, `block-tooltip`), the shared epic state
(`const selectedEpics = new Set(epicNames)`), the fixed tooltip, and 14px panel text. This file
governs everything the regexes cannot; passing the validator alone does NOT make the artifact done.
