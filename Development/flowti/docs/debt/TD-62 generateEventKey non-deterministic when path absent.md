---
severity: medium
category: correctness
layer: domain
status: open
created: 2026-02-15
effort: small
description: "IngestionService.generateEventKey() falls back to UUID when path is undefined, defeating idempotency. Events without paths get unique keys every time, bypassing deduplication."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-62: generateEventKey non-deterministic when path absent

## Problem

The PRD claims "deterministic keys" for ingestion deduplication, but `generateEventKey()` falls back to a UUID when the event payload does not contain a `path` field. This means pathless events produce random keys every time, completely bypassing the deduplication ledger.

Any event type that does not carry a file path in its payload (e.g., custom domain events, system lifecycle events) will be processed on every occurrence, regardless of the "once" emission policy.

## Impact

Events without file paths are processed multiple times instead of being deduplicated. This violates the idempotency guarantee documented in the ingestion domain design.

## Suggested Fix

Use a deterministic fallback instead of UUID. Options include:

1. Hash of event type + serialized payload JSON (e.g., `"eventType::sha256(JSON.stringify(payload))"`)
2. Hash of event type + sorted payload keys and values
3. Require a `correlationId` or `key` field on events that lack a path

## Affected Files

- `src/domain/ingestion/IngestionService.ts` (lines 153-155)
