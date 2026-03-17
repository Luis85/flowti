---
type: Component
domain: Flowti
stage: done
description: "First-run setup wizard modal with 4 pages: Welcome, Review, Progress, Complete"
source: "[[Development/flowti/src/domain/installer/InstallerWizardModal.ts|InstallerWizardModal.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - installer
  - modal
  - component
---

# InstallerWizardModal

## Description

InstallerWizardModal is a 4-page wizard modal shown on first-run to set up the Flowti IBDE plugin. It collects the user name, previews what will be installed (folder structure, user profile), runs the installation with live progress feedback, and shows a completion summary. The modal is shown conditionally via `InstallerWizardModal.showIfNeeded()` — only when `installerService.isInstalled()` returns false.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `app` | `App` | Obsidian App instance for Modal base class |
| `installerService` | `IInstallerService` | Run installation steps, check installed state |
| `eventBus` | `IEventBus` | Subscribe to step progress events |

## State

- `currentPage: WizardPage` — Welcome, Review, Progress, or Complete
- `userName: string` — Collected on Welcome page
- `stepStatuses: InstallerStepStatusEntry[]` — Per-step status tracking (pending/running/completed/failed + message)
- `installSuccess: boolean` — Installation outcome
- `installError: string` — Error message on failure

## Renders

### Welcome Page
- Welcome heading and description
- User name input via Obsidian `Setting` component
- "Next" button (enabled when name is non-empty)

### Review Page
- "What will be installed" preview: step cards showing each installer step (name, description)
- Folder structure preview list
- "Back" and "Install" buttons

### Progress Page
- Step list with live status indicators (pending → running → completed/failed)
- Each step shows name, status icon, and completion message
- Non-dismissible during installation

### Complete Page (Success)
- Success icon and summary message
- "What's next" guidance section
- "Close" button

### Complete Page (Error)
- Error icon and error message
- "Retry" button (resets to Progress page)
- "Close" button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `installer.step.started` | Listens | Update step status to "running" |
| `installer.step.completed` | Listens | Update step status to "completed" with message |

## Related

- Uses: [[First-Run Onboarding]] flow
- Services: InstallerService, UserService
