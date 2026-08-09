# Baseline Feedback Rules

These rules apply to every non-trivial implementation, migration, refactor, docs/workflow/skill change, orchestration change, or agent behavior change.

## Origin

Portable baseline extracted from repeated project failures: vague scope, missing invariants, skipped validation, stale assumptions, secret/key confusion, unsafe shell/path handling, and producer/consumer contract drift.

Examples in these rules use a service/adapter archetype; map them to your project's equivalents (GUI screens and state, pipeline stages and metrics, CLI commands, library API) — the rules themselves are archetype-neutral.

## Rules

### B0: Preflight Frame Must Be Explicit

Before implementation starts, state:

- `Scope`
- `Invariants`
- `Risk list`
- `Validation`

BAD:

```text
I'll just fix the task and test later.
```

GOOD:

```text
Scope: update adapter request parser and progress readback.
Invariants: existing auth and channel IDs remain stable.
Risk list: stale channel state, mismatched request schema.
Validation: unit tests plus one live smoke.
```

### B1: Feedback Selection Must Be Evidence-Based

Load `docs/feedback/index.md`, then load `baseline.md` and only matching topic files.

BAD:

```text
Loaded all feedback files, then used whichever seemed relevant.
```

GOOD:

```text
Loaded index.md, baseline.md, and service-channels.md because the task changes service:// request flow.
```

### B2: Rule Contradictions Block Implementation

If rules conflict, resolve the docs first.

BAD:

```text
One rule says gateway owns the field, another says worker owns it. I picked gateway.
```

GOOD:

```text
The ownership rules conflict. Update feedback docs or ask for decision before coding.
```

### B3: Target Files Must Be Read Before Editing

Read current implementation and nearby patterns before changing files.

BAD:

```text
Created a new helper without checking whether the package already had one.
```

GOOD:

```text
Read existing adapter, tests, and package helpers before adding the narrow change.
```

### B4: Existing Validation Status Must Be Known

Run the project verify/build/test/smoke path when relevant, or record why it is unavailable.

BAD:

```text
Skipped validation because the change looked small.
```

GOOD:

```text
Validation path: docker build plus the affected proof suite. Docker unavailable is a blocker for runnable code closeout.
```

### B5: Dirty Worktree Risk Must Be Understood

Check existing changes before editing in a git worktree. Do not revert unrelated work.

BAD:

```text
Reset the repo to get a clean start.
```

GOOD:

```text
Detected unrelated modified docs; left them untouched and edited only the target files.
```

### B6: Referenced Paths And Imports Must Exist

Verify referenced files, packages, commands, services, and config keys before using them.

BAD:

```text
Imported a package based on a guessed name.
```

GOOD:

```text
Verified the package directory and existing exported type before importing it.
```

### B7: New Public Behavior Needs Proof

Plan tests, proof scripts, smoke checks, or manual evidence for every new public behavior.

BAD:

```text
Added a new API field with no consumer or readback test.
```

GOOD:

```text
Added a consumer-facing proof that reads the new field from the canonical status endpoint.
```

### B8: Secrets, Proxy Keys, And Identities Must Not Be Confused

Separate upstream provider secrets, proxy/client keys, runtime auth refs, and user identities.

BAD:

```text
Used the provider API key as the client-facing proxy key.
```

GOOD:

```text
Provider secret stays in vault; generated proxy key is stored only in the client environment.
```

### B9: Shell, Path, And Context Injection Must Be Considered

Treat user-provided paths, shell args, prompts, docs, and agent context as untrusted unless proven otherwise.

BAD:

```text
Built a shell command by concatenating a user-supplied path.
```

GOOD:

```text
Validated the path root and passed arguments through structured command parameters.
```

### B10: Runtime Integration Point Must Be Named

State where the change is wired into the runtime: scheduler, gateway, spawner, worker, adapter, UI, docs, or client flow.

BAD:

```text
Implemented the helper but did not wire it into any runtime path.
```

GOOD:

```text
The helper is called from the adapter submit path and exposed through progress readback.
```

### B11: Producer And Consumer Must Share A Contract

For channels, tasks, messages, files, APIs, and events, identify sender, receiver, schema, lifecycle state, and readback path.

BAD:

```text
Writer emits `task_done`; reader waits for `completed`.
```

GOOD:

```text
Writer, reader, schema, and terminal state are all named and covered by the same proof.
```

### B12: Commit History Harvesting Is Explicit Only

Do not scan git history during normal preflight. Harvest history into feedback only when the user explicitly asks for it.

BAD:

```text
Every preflight scans six months of commits.
```

GOOD:

```text
Normal preflight uses index.md and selected rules. A separate explicit request runs feedback harvesting.
```

### B13: Artifact Layers Must Stay Separate

Keep rules, skills, commands, hooks, agents, and MCP configs in their own layer. Commands may delegate to skills, but should not fork the canonical workflow.

BAD:

```text
Copied the full verification checklist into both /verify and the verification skill.
```

GOOD:

```text
/verify is a compatibility shim that delegates to the canonical verification skill.
```

### B14: Harness Capabilities Must Be Checked Before Installing Behavior

Before adding hooks, commands, rules, agents, or MCP configs, name the target harness and confirm it supports that artifact type.

BAD:

```text
Installed hook-based enforcement into a harness that has no hooks.
```

GOOD:

```text
Claude receives hooks; Codex receives instructions/sandbox policy because hooks are unavailable there.
```

### B15: Installed Artifacts Need Format Validation

After installing or changing skills, commands, rules, hooks, agents, manifests, or feedback files, run the available validator or perform a documented structural check.

BAD:

```text
Copied a skill folder without checking SKILL.md frontmatter.
```

GOOD:

```text
Checked required frontmatter, non-empty body, and index references after installing the skill.
```

### B16: Install Only The Needed Surface

Avoid copying every agent, skill, MCP server, hook, or rule pack by default. Select the minimal daily set, keep the rest as library/on-demand, and do not flatten layered rule directories.

BAD:

```text
Copied all rule files into one directory, overwriting files with the same names.
```

GOOD:

```text
Installed baseline rules plus selected language/domain directories while preserving directory structure.
```

## Checklist (for preflight)

- B0: Is `Scope / Invariants / Risk list / Validation` explicit?
- B1: Was `docs/feedback/index.md` loaded before topic files?
- B2: Are rule contradictions resolved or marked blocked?
- B3: Were target files and nearby patterns read before editing?
- B4: Is the validation path known, or is missing validation recorded as a blocker?
- B5: Is dirty worktree risk understood?
- B6: Do referenced paths, imports, commands, services, and config keys exist?
- B7: Is proof planned for new public behavior?
- B8: Are secrets, proxy keys, auth refs, and identities separated?
- B9: Are shell, path, prompt, docs, and context injection risks handled?
- B10: Is the runtime integration point named?
- B11: Do producers and consumers share the same contract and readback path?
- B12: Is commit-history feedback harvesting skipped unless explicitly requested?
- B13: Are rules, skills, commands, hooks, agents, and MCP configs kept in separate layers?
- B14: Are target harness capabilities checked before installing behavior?
- B15: Is artifact format/index validation planned after install or edits?
- B16: Is the install surface minimal and are layered directories preserved?
