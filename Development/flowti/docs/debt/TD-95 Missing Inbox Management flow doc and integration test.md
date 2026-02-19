---
type: TechDebt
severity: medium
category: documentation
layer: flows
status: resolved
effort: small
updated: 2026-02-19
resolved: 2026-02-19
description: 4 inbox events exist in the catalog but no Inbox Management flow doc or integration test covers the notification lifecycle.
---
# TD-95: Missing Inbox Management flow doc and integration test

## Problem

The Inbox domain emits 4 events (`inbox.loaded`, `inbox.itemAdded`, `inbox.itemsChanged`, `inbox.refresh`) and has 4 source event mappers (`mapSubscriptionMatched`, `mapImportCompleted`, `mapImportFailed`, `mapExportCompleted`), but no flow document traces the inbox notification lifecycle. All other event-driven domains have corresponding flow docs.

## Impact

- No documentation of the inbox event flow from source event → mapper → inbox item → UI update
- No integration test verifying the inbox notification chain
- Mapper behavior (which source events produce which inbox items) is only visible in source code

## Suggested Remediation

1. Create `docs/flows/Manage Inbox Notifications.md` following the existing flow doc template
2. Cover: source event fires → mapper produces InboxItem → inbox.itemAdded → UI re-render → markRead/dismiss → inbox.itemsChanged
3. Create `tests/flows/inbox-management.flow.test.ts` integration test

## Resolution (2026-02-19)

- **Flow doc**: `docs/flows/Manage Inbox Notifications.md` — created with full 8-step lifecycle (source event → mapper → add item → UI render → read → dismiss → clear → startup load)
- **Integration test**: `tests/flows/15-InboxManagement.test.ts` — 17 tests covering all 6 source events, state management (mark read, dismiss, clear all), source filtering, persistence across load cycles, refresh, dispose cleanup, and end-to-end lifecycle

## Related

- TD-94: Missing Session Management flow doc (resolved)
- [[InboxService]]
- Inbox mappers: `src/domain/inbox/mappers.ts`
