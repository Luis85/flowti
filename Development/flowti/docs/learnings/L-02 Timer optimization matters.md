---
type: Learning
id: L-02
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 3
domain: ui
tags:
  - learning
  - performance
  - ui
---

# L-02: Timer optimization matters

Using direct DOM updates for 1-second timer ticks (`updateTimerDisplay()`) instead of full re-renders prevents UI jank. This pattern should be applied to any future real-time display updates — including dashboard callouts (Increment 3 fix).

## Pattern

- For high-frequency updates (1-second ticks), update only the affected DOM element directly
- Do NOT call `scheduleRender()` or trigger full view re-renders for timer ticks
- Full re-renders are acceptable for lifecycle changes (start, pause, complete)

## When to Apply

- Any UI element that updates more frequently than every 5 seconds
- Real-time counters, progress bars, live indicators
