---
type: Idea
stage: discovery
origin: inbox
domain: data-exchange
description: "Between every pipeline step, allow users to inspect the current data state in a Base view before continuing to the next step."
tags: []
priority: "01 - medium"
rank:
related:
  - "[[Pipeline multi-source merge with master data builder]]"
  - "[[I want to build a well documented data-pipeline]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Once data is imported as notes, each pipeline step could auto-generate or reference a .base file showing the current data state. Users can inspect, filter, add formulas, and massage data before proceeding to the next step (e.g., export or further processing)."
---

## Problem

Pipeline execution is currently opaque between steps. After import, users cannot see the intermediate state of data before it flows to the next step (export or further processing).

## Proposed Solution

1. **Step-level Base view**: Each pipeline step can reference or auto-generate a `.base` file showing imported/processed notes
2. **Pause and inspect**: Pipeline execution can pause between steps for manual review
3. **Formula steps**: A step can apply Base formulas (aggregations, transformations) visible in the intermediate view
4. **Resume**: After inspection, user clicks "Continue" to proceed to next pipeline step
