---
type: TechDebt
severity: low
category: architecture
layer: domain
status: open
updated: 2026-02-16
effort: medium
description: InstallerWizardModal manages page state, user input, step statuses, and rendering in a single class. Reclassified from medium to low — modal is stable, runs once per vault, and is rarely modified.
---
# TD-23: InstallerWizardModal mixes state and rendering

## Problem

`InstallerWizardModal.ts` (~396 lines) handles:
- Page navigation state (`currentPage`)
- User input state (`userName`)
- Step execution status tracking (`stepStatuses`)
- Four distinct page renderings (welcome, review, progress, complete)
- Event listener management

## Suggested Remediation

1. Extract a `InstallerWizardState` class that manages page, input, and status state
2. Extract page renderers into individual functions or components
3. Keep the modal as a thin coordinator

## Assessment (2026-02-16)

Reclassified from **medium → low**. The modal is stable, runs only once per vault during initial setup, and has not been modified since its initial implementation. The 396 LOC file size is acceptable for a self-contained wizard. Low ROI to refactor unless the installer flow is extended with new steps.

## Affected Files

- `src/domain/installer/InstallerWizardModal.ts`
