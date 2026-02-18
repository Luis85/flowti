---
type: TechDebt
severity: medium
category: process
layer: documentation
status: open
effort: small
updated: 2026-02-18
description: Feature Lifecycle PRD was approved (FRI 27) but its PBIs still show stage idea instead of being promoted to planned.
---
# TD-99: Feature Lifecycle PRD PBIs not promoted to planned

## Problem

The Feature Lifecycle PRD (`docs/features/Feature Lifecycle/Feature Lifecycle PRD.md`) was approved with FRI score 27/35, but its associated PBIs still have `stage: idea` in their frontmatter. Per the Development Lifecycle process, approved PRD PBIs should be promoted to `stage: planned` once the PRD passes the Ready gate.

This creates a false signal: the PBIs appear as unrefined ideas when they are actually approved and ready for implementation planning.

## Impact

- Dataview queries filtering by `stage: planned` will miss these PBIs
- Backlog prioritization views show these items as less mature than they are
- Process discipline gap: approved PRDs should trigger PBI promotion

## Suggested Remediation

1. Update all Feature Lifecycle PBIs from `stage: idea` to `stage: planned`
2. Add a checklist item to the PRD approval process: "Promote PBI stages to planned"
3. Consider automating this as part of the frontmatter conformance script

## Related

- [[Feature Lifecycle PRD]]
- [[Development Lifecycle]] (Phase 5: Ready gate)
