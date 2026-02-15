---
severity: low
category: feature-gap
layer: ui
status: open
created: 2026-02-15
effort: small
description: "Vault Health Dashboard PRD has an open acceptance criterion 'Health score exposed as dashboard widget for Hub integration' with no TD or PBI tracking it."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-60: Health widget Hub integration gap

## Problem

The Vault Health Dashboard PRD includes an acceptance criterion for exposing the health score as a dashboard widget for Hub integration. No tech debt item or product backlog item currently tracks this work. The Health Dashboard PRD cannot be marked as fully done until Hubs exist and this widget is built.

## Impact

Health Dashboard stays in draft/incomplete status until Hubs are built. The missing tracking item creates a gap in the project backlog.

## Suggested Fix

Decouple the acceptance criteria:

1. Mark the Health Dashboard PRD as done for its current scope (standalone dashboard view)
2. Create a separate PBI for the Hub widget when the Hub framework (TD-49 through TD-55) is built
3. Reference the Health Dashboard as the data source in the new PBI

## Affected Files

- `docs/features/Vault Health Dashboard/`
