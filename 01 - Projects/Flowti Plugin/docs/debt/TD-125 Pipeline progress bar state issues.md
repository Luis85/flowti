---
type: TechDebt
stage: open
domain: data-exchange
severity: medium
source: "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
related:
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
---

## Description

Three related progress bar issues in the Data Exchange Hub:
1. Pipeline detail page progress bar does not update during execution
2. Starting a second import while the first is running causes progress bars to cross-contaminate
3. Dashboard loses track of running operations when leaving and returning to the view

## Impact

Users cannot accurately monitor import/export/pipeline execution progress.

## Proposed Fix

Introduce operation tracking state (`runningOperations: Map<string, OperationProgress>`) in DataExchangeHubView that persists across tab switches. Use operation IDs to scope progress events to their correct UI elements.

I think this is already fixed.
