---
severity: medium
category: architecture
layer: domain
status: open
effort: medium
description: InstallerWizardModal manages page state, user input, step statuses, and rendering in a single class. The state management should be separated from the view rendering.
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

## Affected Files

- `src/domain/installer/InstallerWizardModal.ts`
