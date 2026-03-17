---
domain: Folder Watcher
id: US-G1
title: Suppress all plugin notifications
persona: Any user
jtbd: Distraction-free workflow
use-cases:
  - UC-49
status: implemented
journey:
parent: "[[03 - Resources/Documentation/Reference/Actors/User|User]]"
---
# US-G1: Suppress all plugin notifications

> JTBD: Distraction-free workflow | Persona: Any user

**As a** user,
**I want** to suppress all notifications from the plugin,
**so that** I can work without distraction while sync runs silently in the background.

## Acceptance Criteria

- [x] A "Show notifications" toggle exists in Settings → Sync Behavior
- [x] When disabled, all `show()`, `error()`, and `success()` notices are suppressed
- [x] The setting takes effect immediately (no restart required)
- [x] The setting defaults to `true` (notifications shown by default)
- [x] The setting persists across plugin restarts
- [x] Logging (`LogService`) is unaffected — errors still appear in debug console and dashboard logs
- [x] Backward-compatible migration from old `suppressNotifications` field

## Implementation

- **FileWatcherSettings** (`src/settings/types.ts`): Added `showNotifications: boolean` field (default `true`)
- **SuppressibleNoticeService** (`src/services/NoticeService.ts`): Wrapper that delegates to the real `NoticeService` but short-circuits when `showNotifications` is `false`. Reads the settings object by reference so toggling takes effect immediately.
- **FileWatcherPlugin** (`src/main.ts`): Wraps `createNoticeService()` with `SuppressibleNoticeService`; includes migration from old `suppressNotifications` field
- **FileWatcherSettingTab** (`src/settings/FileWatcherSettingTab.ts`): Toggle in Sync Behavior section
