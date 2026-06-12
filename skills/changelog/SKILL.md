---
name: changelog
description: Generate a keepachangelog-format changelog section from git history and BMAD stories, shown as a conversation preview by default. Use when the user asks to generate, update, or draft a changelog or release notes from commits. Default mode writes nothing; writing or updating CHANGELOG.md requires explicit --apply in the same request.
metadata:
  safety-class: checkpoint
---

# Changelog Skill

Generate a [Keep a Changelog](https://keepachangelog.com/) section from git
history (and BMAD BMM stories when present). By default the section is shown
as a preview in the conversation only; `--apply` materializes it into
`CHANGELOG.md`.

## Safety Contract

Default mode is preview-only: the generated changelog section goes to the
conversation and NO files are created, modified, or deleted. Writing or
updating `CHANGELOG.md` requires explicit `--apply` in the same request.
Git is read-only input (`git log`, `git describe`); never run `git add`,
`git commit`, or any mutating git command from this skill.

## Usage

```
/changelog                    # Preview section since the latest tag (no writes)
/changelog --from v1.2.0      # Preview section since a specific tag/commit
/changelog --apply            # Write/update CHANGELOG.md with the section
```

| Argument | Meaning | Default |
|----------|---------|---------|
| `--from <tag>` | Starting tag or commit for `git log <from>..HEAD` | latest tag (`git describe --tags --abbrev=0`); all commits if no tags |
| `--apply` | Actually write/update `CHANGELOG.md` | off (preview only) |

## Workflow

1. **Determine the range** — use `--from` if given; otherwise the latest tag
   via `git describe --tags --abbrev=0`; if no tags exist, use all commits.
2. **Gather history** — `git log --oneline <from>..HEAD`.
3. **Categorize commits** by conventional prefix into keepachangelog
   categories:

   | Prefix | Category |
   |--------|----------|
   | `feat:`, `add:` | Added |
   | `fix:`, `bugfix:` | Fixed |
   | `refactor:`, `docs:`, `chore:`, `change:`, `update:` | Changed |
   | `deprecate:` | Deprecated |
   | `remove:`, `delete:` | Removed |
   | `security:` | Security |

4. **Link stories** — search `docs/*/stories/` for related BMAD stories by
   keywords or explicit references; add links to matching entries.
5. **Preview** — print the generated section in the conversation. Without
   `--apply`, STOP here: write nothing.
6. **Apply (only with `--apply`)** — if `CHANGELOG.md` exists, prepend the
   new section after the header; otherwise create the file with the standard
   header (`# Changelog`, the "All notable changes..." line, and the Keep a
   Changelog reference) before the section.

## Output

One concrete preview example (default mode, conversation only):

```markdown
## [Unreleased] - 2026-06-10

### Added
- Cursor-based pagination for the list API ([story-3.2](docs/api/stories/story-3.2.md))
- CSV export for usage reports

### Fixed
- Webhook retries no longer duplicate deliveries
- JWT expiry check uses server time

### Changed
- Storage adapter refactored behind a single interface
```

Without `--apply`, the response ends after this preview and an explicit note
that `CHANGELOG.md` was not modified.

## Completion Status

Protocol (non-negotiable): the VERY LAST line of every run MUST start with exactly one of these tokens, followed by ` — <one-line reason>`. Do not invent other status wording:

- `DONE` — preview generated (default) or `CHANGELOG.md` updated (`--apply`).
- `DONE_WITH_CONCERNS` — section generated but some commits could not be
  categorized or story links are uncertain.
- `BLOCKED` — not a git repository or git history is unavailable.
- `NEEDS_CONTEXT` — ambiguous range or target file; ask before proceeding.
