---
severity: medium
category: reliability
layer: infrastructure
status: open
created: 2026-02-15
effort: small
description: "When TypedStorage.safeLoad() falls back to defaults due to corrupted data, the user is not notified. Silently loses persisted subscriptions, event definitions, ingestion state, or import/export configs."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-56: Storage corruption silent fallback

## Problem

`TypedStorage.safeLoad()` catches parse errors and returns defaults. No event or notification tells the user their data was lost. Any service that relies on persisted state (SubscriptionService, EventDefinitionService, IngestionService, DataExchangeService) will silently revert to empty/default configuration when storage is corrupted.

## Impact

Silent data loss after storage corruption. User discovers it only when configs are missing — subscriptions gone, event definitions reset, import/export saved configs vanished. There is no audit trail showing that a fallback occurred.

## Suggested Fix

Emit a `storage.fallback` event or log a visible warning when fallback occurs. This allows:

1. The EventLogView to surface the fallback to the user
2. Services to react appropriately (e.g., prompt the user to re-import configs)
3. Debugging by checking the event log for fallback events

## Affected Files

- TypedStorage implementation
