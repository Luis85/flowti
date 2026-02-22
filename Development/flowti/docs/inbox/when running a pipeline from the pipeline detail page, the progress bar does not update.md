---
type: Bug
stage: fixed
fixed_in: "Cycle 6"
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
pbi: TD-125
description: "Pipeline progress bar does not update when running a pipeline from the detail page."
tags:
  - fixed
priority: 01 - medium
rank:
related:
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
note: "Fixed pre-Cycle 6. Root cause: shared progress state. Fix: operationId UUID per operation, carried through all dataExchange events. Pipeline detail page now subscribes to its operationId-scoped progress events."
fixed_date: 2026-02-19
fixed_by: "[[Cycle 6 - Session Templates and DX Progress Fixes]]"
---
