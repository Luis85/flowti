---
type: ProductBacklogItem
feature: "[[Installer PRD]]"
priority: high
stage: done
userStories:
  - "[[As User, I want to easily install the Flowti IBDE Plugin so that I can instantly start working with the system]]"
useCases: []
---

## User Story

As a user, I want the Flowti IBDE plugin to guide me through a first-run setup wizard so that my vault is fully configured — user profile created, folder structure scaffolded — without any manual steps.

## Functional Requirements

- [x] On first launch, detect `isInstalled() == false` and open InstallerWizardModal automatically
- [x] Page 1 (Welcome): collect user display name
- [x] Page 2 (Review): show preview of all installation steps with descriptions and folder list
- [x] Page 3 (Progress): execute step pipeline with live status indicators per step
- [x] Page 4 (Complete): display success summary or failure details with retry option
- [x] UserCreationStep (order 10): create user profile note
- [x] FolderScaffoldStep (order 20): scaffold PARA + Connectivity + var folder structure
- [x] Persist installer state so the wizard does not reappear on subsequent launches
- [x] "Restart setup" button in Settings re-opens the wizard after resetting state
- [x] Step pipeline is extensible via `installerService.registerStep()`

## Acceptance Criteria

- [x] Setup wizard opens automatically on first run and does not appear again after completion
- [x] User profile is created with the entered display name
- [x] Full IBDE folder structure (PARA + Connectivity + var) is scaffolded
- [x] Each step shows live progress with pass/fail indicators
- [x] Failed steps can be retried; completed steps are skipped (idempotent)
- [x] Wizard can be re-triggered from Settings at any time
- [x] `npm run build` passes
