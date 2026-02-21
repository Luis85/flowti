---
type: Component
domain: Train
stage: done
description: "Extracted event subscriptions for TrainMainView — 6 listeners for train lifecycle and navigation events"
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

The `setupTrainViewSubscriptions()` function takes a `TrainViewContext` and `IEventBus`, wires up 6 event listeners, and returns an array of unsubscribe functions for cleanup.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription |
| `TrainViewContext` | interface | Context providing `getTrainId()`, `setActiveThoughtIndex()`, `scheduleRender()` |

## Subscriptions

| Event | Condition | Action |
|-------|-----------|--------|
| `train.started` | No active train or same train | Reset to thought 0, schedule render |
| `train.thought.added` | Same train | Schedule render |
| `train.paused` | Same train | Schedule render |
| `train.resumed` | Same train | Schedule render |
| `train.completed` | Same train | Schedule render |
| `train.thought.activated` | Same train | Schedule render |

All listeners filter by `trainId` to avoid reacting to events from other trains.

## API

| Function | Purpose |
|----------|---------|
| `setupTrainViewSubscriptions(ctx, eventBus)` | Wire 6 event listeners, return unsubscribe array |

## Related

- Parent: [[TrainMainView]]
- Pattern: [[SessionWorkspaceSubscriptions]] (same extraction pattern)
- Events: `src/domain/train/events.ts`
