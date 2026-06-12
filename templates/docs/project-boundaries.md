# Project Boundaries

This file defines what each folder, module, runtime, and generated artifact owns.

## Boundary Table

| Area | Owns | Must not own | Allowed dependencies | Proof |
|---|---|---|---|---|
| source code | TODO | generated evidence, operator decisions | TODO | TODO |
| runtime state | TODO | source contracts | TODO | TODO |
| docs | active guidance and contracts | runtime state | source evidence | docs validation or review |
| generated artifacts | generated output | source of truth | generator inputs | regeneration or checksum proof |
| proof scripts | validation evidence | production state | runtime/test inputs | passing proof command |

## Guardrails

- Do not mix runtime authority with generated documentation.
- Do not let adapters own core task truth unless this file says so.
- Do not add cross-subsystem imports or data flow without updating this contract.
- If an area is `N/A`, record why and who owns the equivalent responsibility.
