---
type: Bug
stage: open
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
description: "DX Dashboard loses running state when user navigates away — re-opening shows no progress for in-flight operations."
tags:
priority: 01 - medium
rank:
related:
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
  - "[[I also want to know how long the execution of a Data Exchange Config took]]"
note: "Root cause: dashboard re-renders from scratch on view open — no persisted in-flight operation state. Events fire but the view isn't subscribed when closed."
---
