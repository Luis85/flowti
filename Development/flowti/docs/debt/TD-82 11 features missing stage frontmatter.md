---
severity: medium
category: architecture
layer: cross-cutting
status: open
effort: small
updated: 2026-02-15
description: 11 of 28 feature documents lack the stage frontmatter field, breaking lifecycle tracking, Feature Readiness Index scoring, and database view filtering.
---
# TD-82: 11 features missing `stage` frontmatter field

## Problem

The PRD Template defines `stage` as a required frontmatter field that drives lifecycle tracking and Feature Readiness Index (FRI) scoring. 11 features have no `stage` value:

1. Component Library
2. Multiplayer
3. Onboarding
4. Prototype Builder
5. Requirements Engineering
6. Self documenting Frontend
7. Test Management
8. The Designer
9. Tracking and Reporting
10. User Experience
11. User Story Mapping
12. Vault Health Dashboard

Without `stage`, these features:
- Do not appear in lifecycle-filtered views
- Cannot be scored by the FRI maturity model
- Are invisible in the `02 - Features.base` database when filtering by stage
- Cannot participate in Three Amigos review sessions (which require stage classification)

Additionally, `Requirements Engineering` and `Data Governance` are also missing the `type` frontmatter field.

## Impact

- Feature maturity distribution is inaccurate — 39% of features are uncategorized
- Backlog prioritization cannot include stageless features
- The Feature Lifecycle PRD gate model cannot evaluate these features
- Automated documentation tooling cannot discover or catalog these features by stage

## Suggested Remediation

1. Audit each of the 11 features and assign an appropriate `stage` value (idea, draft, new, approved, design, development, done)
2. Add `type: Feature` to Requirements Engineering and Data Governance
3. Consider adding a frontmatter validation step that flags missing required fields

## Affected Files

- `docs/features/Component Library/`
- `docs/features/Multiplayer/`
- `docs/features/Onboarding/`
- `docs/features/Prototype Builder/`
- `docs/features/Requirements Engineering/`
- `docs/features/Self documenting Frontend/`
- `docs/features/Test Management/`
- `docs/features/The Designer/`
- `docs/features/Tracking and Reporting/`
- `docs/features/User Experience/`
- `docs/features/User Story Mapping/`
- `docs/features/Vault Health Dashboard/`
