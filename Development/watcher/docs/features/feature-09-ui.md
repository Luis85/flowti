---
domain: Folder Watcher
stage: done
plugin: "[[Development/watcher/README|README]]"
type: Feature
---
# Feature 9: User Interface

Covers status bar, dashboard, commands, and health indicators that let the user monitor and control the plugin.

> **Test file:** `tests/acceptance/feature8-10-settings-ui-persistence.test.ts` (shared)
> All UI scenarios require Obsidian DOM and are currently skipped.

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-38 | Status Bar Display | At-a-glance sync status | ⏭️ 0/2 (DOM) |
| UC-39 | Reconcile Progress Reporting | Real-time progress during reconciliation | ⏭️ 0/3 (DOM) |
| UC-40 | Dashboard | Detailed watcher management and logs | ⏭️ 0/3 (DOM) |
| UC-41 | Commands | Keyboard-accessible plugin actions | ⏭️ 0/2 (Plugin API) |
| UC-42 | Watcher Health Monitoring | Identifying idle, warning, or error states | ⏭️ 0/1 (integration) |
