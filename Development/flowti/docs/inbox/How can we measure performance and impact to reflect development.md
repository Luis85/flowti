---
type: Idea
stage: partially-delivered
origin: inbox
domain: meta
description: "Measure performance and impact metrics to reflect on development progress."
tags:
  - question
priority: 01 - medium
rank:
related:
  - "[[Cycle 52 - Architecture Foundation]]"
  - "[[TD-127 Performance observability for growing state]]"
note: "Phase 1 delivered in C52: 7 perf.* events (storage, startup, query, event dispatch, alert), PerfAggregator with rolling window + percentile calculation, auto-generated Performance Report. Phase 2 (performance dashboard UI) deferred — can be built on existing Analytics Hub queries. Phase 3 (optimization) deferred — need data first."
delivered_in: "[[Cycle 52 - Architecture Foundation]]"
---
I want to be able to measure degrading performance of the system and be able to drill down into the cause. 

I want to identify the timeline, events, and development of performance metrics.

Every service should be able to report it's own metrics, which then could be aggregated and displayed on a timeline. 

Performance metrics could be toggled-on and off, to save resources if needed.