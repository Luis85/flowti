---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from plugin activation through installer wizard to a fully scaffolded vault"
domains:
  - Installer
  - User
  - Settings
services:
  - InstallerService
  - UserService
  - SettingsService
events:
  - installer.started
  - installer.step.started
  - installer.step.completed
  - installer.completed
  - user.created
  - settings.changed
tags:
  - flow
  - onboarding
---

# First-Run Onboarding

## Overview

When the Flowti IBDE plugin is enabled for the first time, it detects that no installation state exists and launches the Installer Wizard Modal. The wizard guides the user through creating their profile and scaffolding the vault's PARA folder structure.

## Trigger

Plugin loads and `InstallerService.load()` finds `installed: false` in persisted state.

## Steps

### 1. Plugin Activation

- **View/Service**: main.ts (Plugin orchestrator)
- **User Action**: User enables the Flowti IBDE plugin in Obsidian settings
- **System Response**: Plugin registers all services via ServiceRegistry, calls `onLayoutReady()` to load persisted state
- **Events**: `settings.loaded`, `user.loaded`

### 2. Installation Check

- **View/Service**: InstallerService
- **User Action**: (automatic)
- **System Response**: InstallerService checks `state.installed` — if false, emits event to trigger wizard
- **Events**: `installer.started`

### 3. Installer Wizard Opens

- **View/Service**: InstallerWizardModal
- **User Action**: User sees the Welcome page with plugin description
- **System Response**: Modal displays 4-page wizard: Welcome → Review → Progress → Complete
- **Events**: (none — UI only)

### 4. Review Steps

- **View/Service**: InstallerWizardModal (Review page)
- **User Action**: User reviews the planned installation steps (User Creation, Folder Scaffold)
- **System Response**: Modal lists registered steps with descriptions and order
- **Events**: (none — UI only)

### 5. Execute Pipeline

- **View/Service**: InstallerService
- **User Action**: User clicks "Install" on the Review page
- **System Response**: InstallerService executes steps in order. UserCreationStep creates user profile, FolderScaffoldStep creates PARA folders
- **Events**: `installer.step.started` → `user.created` → `installer.step.completed` → `installer.step.started` → `installer.step.completed`

### 6. Completion

- **View/Service**: InstallerWizardModal (Complete page)
- **User Action**: User sees success confirmation and clicks "Close"
- **System Response**: InstallerService persists `installed: true`, modal closes
- **Events**: `installer.completed`, `settings.changed`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| User name input | Enter name or skip | Required (validation) |
| Restart installer | Settings → "Re-run Installer" | N/A (manual trigger) |

## Events Sequence

```
settings.loaded → user.loaded → installer.started → installer.step.started → user.created → installer.step.completed → installer.step.started → installer.step.completed → installer.completed
```

## Related Use Cases

- [[First-Run Onboarding]] (this flow is the primary journey)
