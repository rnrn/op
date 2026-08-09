# Build Profiles

This file defines core versus optional build, runtime, package, and proof surfaces.

If the project has only one build/runtime/package surface, mark this file `N/A` with rationale and keep the rationale here.

## Profiles

| Profile | Includes | Excludes | Required when | Proof |
|---|---|---|---|---|
| core-runtime | TODO | optional tools, generated packages | normal runtime | TODO |
| dev | local tooling and docs workflow | production-only packaging | development | TODO |
| test | test/proof harness | deploy-only assets | validation | TODO |
| integration-package | external adapters/install bundle | live runtime state | integration delivery | TODO |
| proof-harness | smoke/e2e/evidence scripts | production state ownership | closeout validation | TODO |

## Rules

- Keep core runtime small.
- Put optional surfaces in explicit profiles.
- Do not require integration packages to build for core runtime proof unless this file says so.
- Generated install bundles are artifacts, not the source of truth.
