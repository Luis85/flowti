---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey from configuring time-based session nudges through trigger evaluation, notification display, and session creation
domains:
  - Nudge
  - Session
services:
  - NudgeService
  - SessionService
events:
  - nudge.configure
  - nudge.configured
  - nudge.remove
  - nudge.removed
  - nudge.triggered
  - nudge.dismiss
  - nudge.dismissed
  - nudge.loaded
tags:
  - nudge
  - session
  - notification
---

# Configure Session Nudges

## Overview

Session Nudges are time-based, per-day reminders that prompt the user to start a session at a configured time. Each nudge fires once per day at its scheduled time (exact HH:MM match) and presents an Obsidian notification with "Start" and "Dismiss" buttons. The nudge domain is independent from SessionService — the "Start" action emits `session.create` which the session domain handles. Nudges are configured in User Hub → Preferences → Nudges.

## Trigger

User navigates to User Hub → Preferences → Nudges to configure nudge reminders.

## Steps

### 1. Access Nudge Preferences

- **View/Service**: UserHubView → UserHubPreferences → UserHubNudgePreferences
- **User Action**: Opens User Hub, clicks Preferences tab, selects "Nudges" (bell icon) from the master list
- **System Response**: Detail panel renders the nudges configuration: section header ("Session Nudges — Time-based reminders to start a session. Nudges fire once per day at the configured time."), list of existing nudge configs, and an add form.
- **Events**: `hub.tab.changed`

### 2. View Existing Nudges

- **View/Service**: UserHubNudgePreferences
- **User Action**: (none — automatic)
- **System Response**: Each nudge row shows: enabled/disabled checkbox toggle, title, time badge (e.g., "09:00"), session type label, duration label, and delete (×) button. Two default nudges are pre-created (disabled):
  - "Morning Review" — 09:00, documentation, 25 min
  - "Afternoon Focus" — 14:00, documentation, 50 min
- **Events**: (none — UI display)

### 3. Create a New Nudge

- **View/Service**: UserHubNudgePreferences → NudgeService
- **User Action**: Fills in the add form:
  - **Title** (required) — e.g., "Morning Review"
  - **Time** (HH:MM format) — e.g., "09:00"
  - **Session type** — dropdown from all built-in session types (e.g., documentation, vault-hygiene)
  - **Duration** (minutes) — e.g., 25
  Clicks "Add Nudge".
- **System Response**: Validation: title must be non-empty, time must match `^\d{2}:\d{2}$`. A new config is created with ID `custom-<timestamp>`, `enabled: true`. Emits `nudge.configure`. NudgeService adds the config to state, persists to TypedStorage under key `"nudges"`. Panel re-renders after 50ms debounce.
- **Events**: `nudge.configure` → `nudge.configured`

### 4. Enable / Disable a Nudge

- **View/Service**: UserHubNudgePreferences → NudgeService
- **User Action**: Toggles the checkbox on a nudge row
- **System Response**: Emits `nudge.configure` with the updated enabled state. NudgeService updates the config in-place, persists state. Panel re-renders. Disabled nudges are skipped during evaluation.
- **Events**: `nudge.configure` → `nudge.configured`

### 5. Delete a Nudge

- **View/Service**: UserHubNudgePreferences → NudgeService
- **User Action**: Clicks × button on a nudge row
- **System Response**: Emits `nudge.remove` with `{ id }`. NudgeService removes the config from state AND cleans up any `dismissedToday` entry. Persists state. Panel re-renders.
- **Events**: `nudge.remove` → `nudge.removed`

### 6. Nudge Fires (Runtime)

- **View/Service**: NudgeService (evaluation loop)
- **User Action**: (none — automatic, runs every 60 seconds)
- **System Response**: NudgeService starts a `setInterval` at 60-second intervals during `onLayoutReady()`. Each evaluation cycle:
  1. **Midnight rollover**: If the calendar date changed since last check, clears `dismissedToday` (nudges become eligible again each new day)
  2. For each enabled config:
     - Skip if `config.time !== currentTime` (exact HH:MM match)
     - Skip if already in `dismissedToday`
     - Skip if a session of the same type is already running (`isSessionTypeActive` guard)
  3. On match: emit `nudge.triggered`, then add the ID to `dismissedToday` and persist (prevents re-firing in the same minute)
- **Events**: `nudge.triggered` `{ config }`

### 7. Notification Displayed

- **View/Service**: main.ts → NudgeNotification
- **User Action**: (none — automatic)
- **System Response**: main.ts listens for `nudge.triggered` and calls `showNudgeNotification()`. An Obsidian Notice appears for 30 seconds with:
  - **Title**: nudge title (e.g., "Morning Review")
  - **Subtitle**: "09:00 · 25 min" (time + duration)
  - **"Start" button** (CTA): emits `session.create` with the nudge's session type, title, and duration, then hides the notice
  - **"Dismiss" button**: emits `nudge.dismiss` with `{ id }`, then hides the notice
  If neither button is clicked, the notice auto-hides after 30 seconds.
- **Events**: (none on display; Start → `session.create`, Dismiss → `nudge.dismiss`)

### 8. User Starts Session from Nudge

- **View/Service**: NudgeNotification → SessionService
- **User Action**: Clicks "Start"
- **System Response**: Emits `session.create` with `{ type: config.sessionType, title: config.title, durationMinutes: config.durationMinutes }`. SessionService creates a new session. The nudge is already in `dismissedToday` (from step 6).
- **Events**: `session.create` → `session.created`

### 9. User Dismisses Nudge

- **View/Service**: NudgeNotification → NudgeService
- **User Action**: Clicks "Dismiss"
- **System Response**: Emits `nudge.dismiss` with `{ id }`. NudgeService adds the ID to `dismissedToday` (idempotent — checks first) and emits `nudge.dismissed`. The nudge will not fire again today.
- **Events**: `nudge.dismiss` → `nudge.dismissed`

## Dashboard Widget

The User Hub Dashboard shows a "Next nudge" widget when at least one enabled, non-dismissed nudge is scheduled later than the current time. It displays: bell icon, "Next: {title}", time badge, and session type label. Read-only — clicking does nothing.

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Nudge time | Any HH:MM (24-hour) | 09:00 |
| Session type | All built-in session types | documentation |
| Duration | Any positive integer (minutes) | 25 |
| Dismissal scope | Per-day (resets at midnight) | Per-day |
| Same-type guard | Skip if session of same type running | Active |

## Events Sequence

```
[Every 60 seconds]
    → NudgeService.evaluate()
    → midnight rollover check (clear dismissedToday if new day)
    → for each enabled nudge at current time:
        → nudge.triggered { config }
        → [auto-add to dismissedToday]

[Notification appears]
    → [User clicks Start]  → session.create → session.created
    → [User clicks Dismiss] → nudge.dismiss → nudge.dismissed
    → [30s timeout]         → auto-hide (already in dismissedToday)
```

## Persistence

| Key | Storage | Shape |
|-----|---------|-------|
| `"nudges"` | TypedStorage | `{ configs: NudgeConfig[], dismissedToday: string[], lastRolloverDate: string }` |

## Related Use Cases

- [[Create and Manage Sessions]] (nudge "Start" creates a session)
- [[Navigate the User Hub]] (dashboard shows next nudge widget)
- [[Configure Your Profile and Preferences]] (nudges are a Preferences sub-section)
