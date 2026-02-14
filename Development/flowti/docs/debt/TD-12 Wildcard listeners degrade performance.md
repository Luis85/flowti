---
severity: low
category: performance
layer: domain
status: open
updated: 2026-02-14
effort: medium
description: EventNotificationService and SubscriptionService each register a wildcard listener that processes every event emitted on the EventBus. At scale, this creates O(n) overhead per event where n is the number of wildcard listeners.
---
# TD-12: Wildcard listeners on all events degrade performance at scale

## Problem

Two domain services register `eventBus.on("*", ...)` listeners:

1. **EventNotificationService** — checks every event against the notified types list
2. **SubscriptionService** — checks every event against all subscription filters

Additionally, **EventDefinitionService** uses multiple typed listeners but could grow to wildcard usage.

The EventBus processes wildcard handlers after type-specific handlers for every `emit()` call.

## Impact

- Every event (including high-frequency events like `metadata.changed`, `file.modified`) triggers filter evaluation in both services
- Performance degrades linearly with event volume and number of subscriptions
- During bulk operations (CSV import creating hundreds of files), this creates significant overhead

## Suggested Remediation

1. Replace wildcard listeners with targeted subscriptions to the specific event types the user has configured
2. When a notification/subscription config changes, dynamically register/unregister listeners for the relevant types
3. Add a debounce/batch mechanism for high-frequency events
4. Consider adding a `filter` parameter to `eventBus.on()` that pre-filters at the bus level

## Current Assessment

As of Feb 2026, there are 7 wildcard listeners in the codebase. All wildcard listeners use `isSkippedEvent()` to filter out internal event prefixes (`log.*`, `error.*`, `plugin.*`, etc.), reducing unnecessary processing. At current event volumes (< 1000 events/minute), this is not a performance concern. The O(n) dispatch would only become an issue at enterprise-scale event volumes.

## Affected Files

- `src/domain/eventNotify/EventNotificationService.ts`
- `src/domain/subscription/SubscriptionService.ts`
