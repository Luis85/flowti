---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - settings.loaded
  - settings.updated
  - settings.updateDocsRootPath
  - settings.updateShowSystemEvents
maturity: L4
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 1
design_cost: 2
test_cost: 2
priority: 0
---

# Settings PRD

## 1. Problem Statement

The Flowti plugin has numerous configurable behaviors -- documentation paths, event system toggles, ingestion parameters, subscription defaults, and UI preferences. These settings must be persisted across sessions, reactive to changes (so other services update immediately), and accessible through both the Obsidian Settings tab and programmatic API. Without a centralized, event-driven settings system, each service would manage its own configuration independently, leading to inconsistency and stale state.

## 2. Outcome

A centralized `SettingsService` manages all plugin configuration with event-driven reactivity. Changes made in the Settings tab immediately propagate to all dependent services via the EventBus. Settings persist to Obsidian's plugin data store and survive reloads. The dual-state architecture ensures internal state and persisted state stay synchronized, preventing the overwrite bug where default settings clobber saved values.

## 3. Scope

### In Scope

- Centralized `SettingsService` with typed `FlowtiSettings` interface
- Obsidian `FlowtiSettingTab` UI integration
- Event-driven settings propagation via EventBus
- Persistent storage via Obsidian plugin data API
- `DEFAULT_SETTINGS` with sensible defaults for all fields
- Explicit `.load()` in `onLayoutReady()` to prevent dual-state bug
- Migration support (e.g., `eventDocsBasePath` to `docsRootPath`)
- Settings categories: General, Documentation, Event System, Ingestion, Data Exchange

### Out of Scope

- Per-vault settings (multi-vault support)
- Settings import/export
- Settings profiles or presets
- Undo/redo for settings changes
- Remote settings sync

## 4. UX Entry Points

- **Obsidian Settings tab**: Settings > Community Plugins > Flowti IBDE
- **Programmatic**: `settingsService.getSettings()` and `settingsService.updateSettings(partial)`
- **Event-driven**: Any service can listen for `settings.updated` or specific update events

## 5. Functional Requirements

- [x] Provide `FlowtiSettingTab` as Obsidian PluginSettingTab
- [x] Persist all settings to Obsidian's plugin data store
- [x] Load settings on `onLayoutReady()` to prevent dual-state overwrite bug
- [x] Emit `settings.loaded` event after initial load
- [x] Emit `settings.updated` event on every settings change
- [x] Emit specific events for key settings (`settings.updateDocsRootPath`, `settings.updateShowSystemEvents`)
- [x] Provide `DEFAULT_SETTINGS` as fallback for all fields
- [x] Support partial updates via `updateSettings(partial)`
- [x] Migrate legacy `eventDocsBasePath` to `docsRootPath` on load
- [x] Settings UI grouped by category with appropriate input controls (text, toggle, dropdown, number)
- [x] Validate settings values before persisting

## 6. Data Model Impact

| Entity | Key Fields | Storage |
|--------|-----------|---------|
| `FlowtiSettings` | docsRootPath, showSystemEvents, ingestionConcurrency, ingestionBatchWindowMs, ingestionMaxRetries, ingestionWatchEventTypes, watchFolders | Obsidian plugin data |
| `DEFAULT_SETTINGS` | All fields with sensible defaults | Constant |

## 7. Event Impact

### Produced

- `settings.loaded` -- Settings loaded from storage on startup
- `settings.updated` -- Any setting value changed (payload: full settings object)
- `settings.updateDocsRootPath` -- Documentation root path changed
- `settings.updateShowSystemEvents` -- System event visibility toggled

### Consumed

- `settings.updateShowSystemEvents` -- From Event Catalog toggle chip (View to Service)
- `settings.updateDocsRootPath` -- From Settings tab input

## 8. UI Layout Impact

- **FlowtiSettingTab**: Full Obsidian settings page with grouped sections
  - General: User profile, plugin behavior
  - Documentation: `docsRootPath` text input
  - Event System: `showSystemEvents` toggle, event catalog preferences
  - Ingestion: concurrency, batch window, max retries, watch event types, watch folders
  - Setup: "Restart setup" button (installer integration)

## 9. Adapter Impact

- `SettingsService`: Core settings management -- load, save, update, migrate, emit events
- `FlowtiSettingTab`: Obsidian `PluginSettingTab` subclass rendering the settings UI
- `IStorageProvider`: Underlying persistence layer (Obsidian's `loadData()`/`saveData()`)
- EventBus integration: All settings changes emit events for reactive updates

## 10. Non-Functional Requirements

- Settings load must complete before any dependent service initializes
- Settings save must be debounced to prevent rapid-fire writes
- All settings must have sensible defaults (never undefined at runtime)
- Settings migration must be backward-compatible (old settings still load)
- Settings UI must render within 200ms

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dual-state bug: internal state diverges from persisted state | High | Explicit `.load()` in `onLayoutReady()`; documented as key gotcha |
| Settings migration fails on edge cases | Medium | Defensive migration with null checks and fallback to defaults |
| Rapid settings changes cause write conflicts | Low | Debounced save with last-write-wins |
| New settings added without defaults cause undefined access | Medium | `DEFAULT_SETTINGS` spread on every load; TypeScript enforces completeness |

## 12. Acceptance Criteria

- [x] Settings tab renders all configuration options grouped by category
- [x] Changing a setting persists the value across plugin reloads
- [x] `settings.updated` event fires on every change with correct payload
- [x] `settings.loaded` event fires on startup after loading from storage
- [x] Specific events fire for `docsRootPath` and `showSystemEvents` changes
- [x] Default settings apply for fresh installations (no prior data)
- [x] Legacy `eventDocsBasePath` migrates to `docsRootPath` seamlessly
- [x] Dependent services react to settings changes in real-time
- [x] "Restart setup" button resets installer and opens wizard
- [x] Settings never contain undefined values at runtime

## 13. Definition of Done

- All acceptance criteria verified manually
- SettingsService unit tested (load, save, update, migrate, event emission)
- Dual-state bug regression test in place
- Settings migration tested with legacy data
- FlowtiSettingTab renders correctly in Obsidian
- `npm run build` passes (vitest, tsc, eslint, esbuild)
