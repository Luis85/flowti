---
type: Component
domain: Flowti
stage: done
description: "Rich Obsidian Notice for nudge alerts with Start session and Dismiss buttons"
source: "[[Development/flowti/src/ui/NudgeNotification.ts|NudgeNotification.ts]]"
parent: "[[NudgeService]]"
tags:
  - nudge
  - component
---

# NudgeNotification

## Description

NudgeNotification renders a rich Obsidian Notice when a scheduled nudge fires. The notice shows the nudge title, time + duration info, and two action buttons: "Start" (creates a session with the nudge's type and duration) and "Dismiss" (silences the nudge for today). Auto-dismisses after 30 seconds if no action is taken.

The `buildNudgeNotificationFragment()` function is exposed separately for testing.

## Exports

| Export | Purpose |
|--------|---------|
| `showNudgeNotification(config, eventBus)` | Shows the nudge notice |
| `buildNudgeNotificationFragment(config, eventBus, onHide)` | Builds the DOM fragment (testable) |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `Notice` | obsidian | Base notice container |
| `NudgeConfig` | type | Nudge configuration: `id`, `title`, `time`, `sessionType`, `durationMinutes` |
| `IEventBus` | interface | Event bus for emitting session create and nudge dismiss |

## Renders

- Vertical layout: title (bold) + subtitle (time + duration) + button row
- "Start" button (CTA style) + "Dismiss" button (default style)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.create` | Emitted | Start button creates session with nudge config |
| `nudge.dismiss` | Emitted | Dismiss button silences nudge for today |

## Related

- Consumer: NudgeService (fires nudge notifications on schedule)
- Domain: `src/domain/nudge/types.ts`
