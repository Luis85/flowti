---
type: UseCase
domain: Flowti
stage: done
description: Open the Health tab to see an overall vault health score, review 6 diagnostic checks grouped by category, and identify areas needing attention.
view: "[[Event Catalog View]]"
feature: "[[Vault Health Dashboard PRD]]"
testplanRef: UC-93
tags:
  - use-case
  - catalog
  - health
---

# Review Vault Health Score

## Summary

A user wants a quick overview of their vault's documentation and configuration health. They open the Health tab in the Event Catalog to see an aggregate score and identify which areas (documentation, consistency, references, coverage) need attention.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog View is open.
- At least one domain, service, flow, or event exists in the catalog.

## Steps

1. **Navigate to the Health tab** — The user clicks the "Health" tab (heart-pulse icon) in the Event Catalog tab bar. The system scans all entity tabs for fresh data and computes 6 health checks.
2. **Review the overall score** — The master panel displays a large score card with the aggregate health percentage (0–100), color-coded green (>= 80), yellow (>= 50), or red (< 50). Below the score, a summary shows "N of M checks passing."
3. **Scan check categories** — Below the score card, checks are grouped under 4 category headers: Documentation, Consistency, References, Coverage. Each check row shows a severity dot (green/yellow/red), check title, and score percentage badge.
4. **Identify failing checks** — The user scans for yellow or red severity dots. These indicate checks that did not fully pass and may require attention.
5. **Select a check for details** — The user clicks a check row (e.g., "Documentation Coverage"). The detail panel populates with the check's full information: title, severity badge, score percentage, item count, summary text, progress bar, and the list of affected items.
6. **Review affected items** — The detail panel lists each affected item with its name and reason (e.g., "Orphan — No domain doc file"). The user reads the reasons to understand what needs to be fixed.

## Outcome

The user has a clear picture of their vault's health status. They know the overall score, which checks are passing or failing, and exactly which entities are causing issues. They can now proceed to fix specific items or navigate to the relevant tabs.

## Variations

- **Perfect score**: All checks pass with 100%. The score card shows green, and all severity dots are green. Selecting any check shows "No issues found" in the detail panel.
- **Empty vault**: With no entity documentation, documentation coverage shows 100% (0/0 = no issues), frontmatter completeness shows 100% (no entities to check), and all other checks pass trivially.
- **Search filter**: The user types in the search bar to filter checks by title or summary text (e.g., typing "coverage" shows only coverage-related checks).

## Related

- View: [[Event Catalog View]]
- Feature: [[Vault Health Dashboard]]
- Test: UC-93 in [[Testplan and Teststrategy]]
