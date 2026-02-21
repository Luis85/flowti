---
type: Flow
domain: Flowti
stage: done
description: Infrastructure-level plugin settings via Obsidian's Settings panel — event system toggle, documentation paths, entity folder paths, and debug mode
domains:
  - Settings
services:
  - SettingsService
  - InstallerService
events:
  - settings.changed
  - settings.loaded
tags:
  - settings
  - configuration
---

# Configure Plugin Settings

## Overview

The Flowti Settings tab in Obsidian's Settings panel provides cross-domain infrastructure configuration. This is distinct from User Hub Preferences (which handles personal settings like inbox sources, custom session types, and nudges). The Settings tab controls fundamental plugin behavior: the event system master toggle, documentation root path, per-entity folder paths, debug mode, and the setup wizard reset.

## Trigger

User opens Obsidian Settings (gear icon or `Ctrl+,`) and clicks "Flowti" in the Community Plugins section.

## Steps

### 1. Open Plugin Settings

- **View/Service**: Obsidian Settings → FlowtiSettingTab
- **User Action**: Opens Obsidian Settings, selects "Flowti" from the plugin list
- **System Response**: `FlowtiSettingTab` renders 5 sections. All changes save immediately via `saveSettings()` and propagate through `settings.changed`.
- **Events**: (none on open)

### 2. Setup Section

- **Setting**: "Run setup wizard" — Button: "Restart setup"
- **User Action**: Clicks "Restart setup"
- **System Response**: Calls `installerService.reset()`, then opens the `InstallerWizardModal`. The wizard re-runs the initial vault scaffolding (user profile creation, PARA folder structure).
- **Events**: `installer.started`

### 3. Event System Section

- **Setting**: "Enable event system" — Toggle (default: `true`)
  - When disabled: ingestion, subscriptions, and event definitions stop processing. Low-level file events still fire but are not evaluated by domain services.
- **Setting**: "Show system events" — Toggle (default: `false`)
  - Shows/hides internal plugin events tagged `["system"]` in the Event Catalog. Does not affect event processing, only catalog visibility.
- **User Action**: Toggles either setting
- **System Response**: Setting saved immediately. `settings.changed` propagates to all listeners. SubscriptionService, IngestionService, and EventDefinitionService check `eventSystemEnabled` on each evaluation cycle.
- **Events**: `settings.changed`

### 4. Documentation Section

- **Setting**: "Documentation root path" — Text field (default: `03 - Resources/Documentation/Reference`)
  - Vault folder under which all documentation subfolders are created (Events, Domains, Services, Categories, Flows, Systems, Actors, Products)
- **User Action**: Changes the path value
- **System Response**: Setting saved. All entity tab render methods in the Event Catalog use this path to scan for and create documentation files.
- **Events**: `settings.changed`

### 5. Entity Folder Paths Section

For each of 7 entity types (Events, Domains, Services, Categories, Flows, Systems, Actors), two settings:

- **"{Entity} subfolder"** — Text field. Subfolder name appended to the documentation root path (e.g., `Events` → full path becomes `03 - Resources/Documentation/Reference/Events/`)
- **"{Entity} override path"** — Text field. When set, completely overrides the root + subfolder combination with an absolute vault path. Leave empty for default behavior.

- **User Action**: Changes subfolder name or sets an override path
- **System Response**: Setting saved. Entity scanners use the resolved path (override if set, otherwise root + subfolder) for file discovery and CRUD operations.
- **Events**: `settings.changed`

### 6. General Section

- **Setting**: "Debug mode" — Toggle (default: `false`)
  - Logs detailed diagnostic information to the developer console (`Ctrl+Shift+I`)
- **User Action**: Toggles debug mode
- **System Response**: Setting saved. Logger instances check this flag to emit verbose debug output.
- **Events**: `settings.changed`

## Settings Summary

| Section | Setting | Type | Default |
|---------|---------|------|---------|
| Setup | Run setup wizard | Button | — |
| Event System | Enable event system | Toggle | `true` |
| Event System | Show system events | Toggle | `false` |
| Documentation | Documentation root path | Text | `03 - Resources/Documentation/Reference` |
| Entity Paths | {Entity} subfolder (×7) | Text | `Events`, `Domains`, `Services`, etc. |
| Entity Paths | {Entity} override path (×7) | Text | (empty) |
| General | Debug mode | Toggle | `false` |

## Relationship to User Hub Preferences

The Settings tab comment explicitly states: "Cross-domain infrastructure settings only. Domain-specific settings (User, Inbox, Sessions) are configured in User Hub → Preferences tab."

| Setting Type | Location |
|-------------|----------|
| Event system, doc paths, entity paths, debug | Obsidian Settings → Flowti |
| Display name, inbox sources, custom types, templates, nudges | User Hub → Preferences |

## Related Use Cases

- [[First-Run Onboarding]] (setup wizard re-run)
- [[Browse and Configure Events]] (event system toggle, system events visibility)
- [[Create Domain Documentation]] (documentation root path, entity folder paths)
- [[Configure Your Profile and Preferences]] (companion: domain-specific preferences)
