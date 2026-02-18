---
type: Bug
stage: fixed
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
description: "Starting a second import while one is running causes progress bars to merge — both operations share the same progress state."
tags:
  - fixed
priority: 01 - medium
rank:
related:
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
note: "Fixed pre-Cycle 6. Root cause: single progressState shared across concurrent operations. Fix: each operation gets a unique operationId UUID. All progress events (started, progress, completed, failed) carry operationId for correlation. UI renders per-operation progress bars."
fixed_date: 2026-02-19
fixed_by: "[[Cycle 6 - Session Templates and DX Progress Fixes]]"
---
