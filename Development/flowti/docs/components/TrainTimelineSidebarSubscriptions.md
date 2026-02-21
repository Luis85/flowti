---
type: Component
domain: Train
stage: done
description: "Extracted event subscriptions for TrainTimelineSidebar -- 6 listeners for train lifecycle, navigation, and thought activation"
source: "[[Development/flowti/src/ui/train/TrainTimelineSidebarSubscriptions.ts|TrainTimelineSidebarSubscriptions.ts]]"
parent: "[[TrainTimelineSidebar]]"
tags:
  - train
  - component
  - subscriptions
---

# TrainTimelineSidebarSubscriptions

## Description

TrainTimelineSidebarSubscriptions extracts event subscription setup from TrainTimelineSidebar into a standalone module. This follows the same pattern as `TrainMainViewSubscriptions.ts` -- keeping the view class focused on rendering while subscriptions live in a separate file.

The `setupTrainTimelineSubscriptions()` function takes a `TrainTimelineContext` and `IEventBus`, wires up 6 event listeners, and returns an array of unsubscribe functions for cleanup.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Event subscription |
| `TrainTimelineContext` | interface | Context providing `getTrainId()`, `setTrainId()`, `setActiveThoughtId()`, `scheduleRender()` |

## Subscriptions

| Event | Condition | Action |
|-------|-----------|--------|
| `train.started` | Always | Set train ID, reset active thought, schedule render |
| `train.thought.added` | Same train | Schedule render |
| `train.paused` | Same train | Schedule render |
| `train.resumed` | Same train | Schedule render |
| `train.completed` | Same train | Schedule render |
| `train.thought.activated` | Same train | Set active thought ID, schedule render |

All listeners (except `train.started`) filter by `trainId` to avoid reacting to events from other trains. The `train.started` listener always switches to the new train.

## API

| Function | Purpose |
|----------|---------|
| `setupTrainTimelineSubscriptions(ctx, eventBus)` | Wire 6 event listeners, return unsubscribe array |

## Related

- Parent: [[TrainTimelineSidebar]]
- Pattern: [[TrainMainViewSubscriptions]] (same extraction pattern)
- Events: `src/domain/train/events.ts`
