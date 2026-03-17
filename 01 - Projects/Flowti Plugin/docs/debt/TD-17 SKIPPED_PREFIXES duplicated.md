---
type: TechDebt
severity: medium
category: duplication
layer: cross-cutting
status: resolved
resolved: 2026-02-14
effort: small
description: The SKIPPED_PREFIXES constant (filtering out log.*, error.*, plugin.*, service.*, command.*, view.* events) is defined independently in 4 services. Should be a shared constant.
---
# TD-17: SKIPPED_PREFIXES duplicated in 4 services

## Problem

The following services each define their own copy of event prefix filters:

- `EventDefinitionService.ts`
- `SubscriptionService.ts`
- `IngestionService.ts`
- `DiscoveryService.ts` (implicit via event filtering)

Each list slightly differs, creating inconsistency risk.

## Suggested Remediation

1. Define a shared constant in `infrastructure/events/catalog.ts` (already exists for event catalog):
   ```typescript
   export const INTERNAL_EVENT_PREFIXES = ["log.", "error.", "plugin.", "service.", "command.", "view."];
   ```
2. Import and use in all services

## Affected Files

- `src/domain/eventDefinition/EventDefinitionService.ts`
- `src/domain/subscription/SubscriptionService.ts`
- `src/domain/ingestion/IngestionService.ts`
- `src/domain/discovery/DiscoveryService.ts`

## Resolution

Centralized in `src/infrastructure/events/catalog.ts` as `INTERNAL_EVENT_PREFIXES` with an `isSkippedEvent(eventType, extraPrefixes?)` function. All services now import and use this shared utility, with optional extra prefixes for domain-specific filtering (e.g., SubscriptionService adds `subscription.*`).
