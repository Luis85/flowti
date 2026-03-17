---
type: IterationPlan
name: CLI Integration
number: 1
status: new
startDate: 2026-03-17
endDate: 2026-03-31
goal: Complete CLI management integration and move Plugin to projects folder
agents:
  - Product Owner|product-owner.md
  - Software Architect|software-architect.md
  - Software Developer|software-developer.md
---

# #1 — CLI Integration

First Plugin iteration managed by the Flowti CLI. Validates that all management domains, report pipeline, review gates, publish pipeline, and iteration orchestration work correctly for the Plugin.

## Goal

Complete CLI management integration and move Plugin to projects folder

## Scope Items

- [ ] Verify all management commands work (resources, timelog, deliverables, RAID, CAPA, requirements)
- [ ] Verify report pipeline runs end-to-end
- [ ] Verify health scoring across all 6 dimensions
- [ ] Move Plugin to `01 - Projects/Flowti Plugin/`
- [ ] Update all path references post-move
- [ ] Run full test suite from new location

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-17 | — | new | Initial iteration created during CLI integration |
