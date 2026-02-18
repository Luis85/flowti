---
type: Bug
stage: open
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
description: "Starting a second import while one is running causes progress bars to merge — both operations share the same progress state."
tags:
priority: 01 - medium
rank:
related:
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
note: "Root cause likely: single progress state shared across concurrent operations. Each operation needs its own progress tracking keyed by config ID or run ID."
---
