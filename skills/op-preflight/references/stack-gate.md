# Stack-deviation gate (read when the change CREATES code files)

The full gate behind Workflow step 3's one-line trigger. Enforces GP1 (declared-wins): a language
nobody declared must be a recorded, isolated, human-accepted Decision — never silently chosen.

## 1. Stack-deviation gate

When the change creates code files, run the global-tree guard — `~/.claude/scripts/lib/stack-check.mjs`
— **not** a per-project `scripts/lib/...` path: it is NOT vendored into the repo, so resolving it
against the project root fails with `MODULE_NOT_FOUND`. From inside a skill it resolves as
`<skillDir>/../../../scripts/lib/stack-check.mjs`, exactly as `op-watch/scripts/accept.mjs` does.

```
node ~/.claude/scripts/lib/stack-check.mjs --declared "<Stack Profile language(s)>" --files "<planned files>"
```

(pass `--help` for usage.) A file in a **non-declared** language is a deviation: it needs a recorded
`### Decision` (why this language) + isolation in a separate dir — score it `WATCH`, not `PASS`, until
the decision is logged. A spec's *illustrative* code is not a mandate to add a language (GP1).

## 2. Undeclared-stack gate

If `AGENTS.md` Stack Profile `Language(s)` is missing or `TODO` and the change creates code, score
`WATCH` and stop to declare the language first — an undeclared stack turns the deviation guard *off*,
so a polyglot spec will pull in a language nobody requested. Detect the project's actual language from
`go.mod`/`package.json`/etc. and record it.

## 3. Human-accept-only

A stack-deviation `### Decision` must be **HUMAN-accepted**. A model drafts it `status: pending` and
**hands off** (the unit stays deferred, the loop stops at handoff); it never flips its own deviation to
`accepted` — self-authorizing a language nobody asked for is exactly the overreach this gate exists to stop.
