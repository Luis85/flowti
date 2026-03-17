---
type: Bug
stage: fixed
fixed_in: "Cycle 6"
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
pbi: TD-125
description: "DX Dashboard loses running state when user navigates away — re-opening shows no progress for in-flight operations."
tags:
  - fixed
priority: 01 - medium
rank:
related:
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
  - "[[I also want to know how long the execution of a Data Exchange Config took]]"
note: "Fixed pre-Cycle 6. Root cause: dashboard re-rendered from scratch with no persisted state. Fix: CsvDisplaySettings type persisted via DataExchangeState — sort, filter, hidden columns, and lastImportedAt survive view close/reopen."
fixed_date: 2026-02-19
fixed_by: "[[Cycle 6 - Session Templates and DX Progress Fixes]]"
---
