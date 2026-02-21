---
type: Component
domain: Train
stage: done
description: "Extracted event subscriptions for TrainMainView — 7 listeners for train lifecycle, navigation, and timer events"
source: "[[Development/flowti/src/ui/train/TrainMainViewSubscriptions.ts|TrainMainViewSubscriptions.ts]]"
parent: "[[TrainMainView]]"
tags:
  - train
  - component
  - subscriptions
---

# TrainMainViewSubscriptions

## Description

TrainMainViewSubscriptions extracts event subscription setup from TrainMainView into a standalone module. This follows the same pattern as `SessionWorkspaceSubscriptions.ts` — keeping the view class focused on rendering while subscriptions live in a separate file.

The `setupTrainViewSubscriptions()` function takes a `TrainViewContext` and `IEventBus`, wires up 7 event listeners, and returns an array of unsubscribe functions for cleanup.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription |
| `TrainViewContext` | interface | Context providing `getTrainId()`, `setTrainId()`, `setActiveThoughtIndex()`, `scheduleRender()`, `updateTimerDisplay()` |

## Subscriptions

| Event | Condition | Action |
|-------|-----------|--------|
| `train.started` | Always | **Set trainId** via `ctx.setTrainId()`, reset to thought 0, schedule render |
| `train.thought.added` | Same train | Schedule render |
| `train.paused` | Same train | Schedule render |
| `train.resumed` | Same train | Schedule render |
| `train.completed` | Same train | Schedule render |
| `train.thought.activated` | Same train | Set active thought index, schedule render |
| `session.timer.tick` | Same session | Update timer display (DOM-only, no full re-render) |

All listeners (except `train.started` and `session.timer.tick`) filter by `trainId` to avoid reacting to events from other trains. The `train.started` listener always switches to the new train and sets the trainId on the context. The `session.timer.tick` listener filters by sessionId.

## API

| Function | Purpose |
|----------|---------|
| `setupTrainViewSubscriptions(ctx, eventBus)` | Wire 7 event listeners, return unsubscribe array |

## Related

- Parent: [[TrainMainView]]
- Pattern: [[SessionWorkspaceSubscriptions]] (same extraction pattern)
- Events: `src/domain/train/events.ts`
