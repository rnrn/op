# Subsystem Doc Contracts

Define each subsystem's owner, source of truth, and required proof.

| Subsystem | Owner docs | Runtime rung | Source of truth | Required proof |
|---|---|---|---|---|
| core | TODO | TODO | TODO | TODO |
| integration | TODO | TODO | TODO | TODO |
| docs | `docs/INDEX.md` | `N/A` | `docs/INDEX.md` | docs validation or review |
| feedback | `docs/feedback/index.md` | `N/A` | `docs/feedback/index.md` | selected preflight checklist |

## Rules

- A subsystem must have one owner.
- If ownership is unclear, update this file before implementation.
- Proof must validate the affected runtime rung, not only the edited file.
- Generated artifacts must name their generator as source of truth.
