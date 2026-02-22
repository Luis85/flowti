---
type: Idea
stage: promoted
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
pbi: PBI-008
description: "Track and display execution duration for import, export, and pipeline runs."
tags:
priority: 01 - medium
rank:
related:
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
note: "Events already carry timestamps. Duration could be computed from start/complete event pairs. Also: chunking the importer into 500 items would help with large imports."
---

chunking the importer into 500 items would also help
