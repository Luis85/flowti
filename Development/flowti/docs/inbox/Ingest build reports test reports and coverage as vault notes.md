---
type: idea
stage: discovery
origin: inbox
domain: ingestion
description: "Auto-ingest Vitest JSON reports, V8 coverage summaries, and git log as typed vault notes for analysis and trending."
tags: []
priority: "01 - medium"
rank:
related:
  - "[[I want to ingest a test-report, a coverage-report, prds, the git-history and lifecycle documents for further analysis]]"
  - "[[How can we measure performance and impact to reflect development]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Build reports already land in docs/reports/builds/ as BuildReport typed notes. Extend this pattern: (1) Vitest JSON reporter output -> TestReport notes with pass/fail/skip counts, (2) V8 coverage summary -> CoverageReport notes with line/branch/function percentages, (3) git log -> CommitReport notes. All typed, all queryable in Base views, all part of the knowledge graph."
---

## Problem

Test results, coverage data, and git history exist only as raw files or terminal output. They are not part of the knowledge graph and cannot be queried, trended, or correlated with development cycles.

## Proposed Solution

1. **Vitest JSON ingestion**: Parse `vitest-report.json` into `TestReport` typed notes
2. **Coverage ingestion**: Parse V8 coverage summary into `CoverageReport` typed notes
3. **Git log ingestion**: Parse `git log --format=json` into `CommitReport` typed notes
4. **Auto-trigger**: Optionally trigger after `npm run build:distribution` via build script hook
5. **Trending Base views**: Provide a `.base` file template that shows test/coverage trends over time
