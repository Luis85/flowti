---
type: TechDebt
severity: medium
category: documentation
layer: flows
status: open
effort: small
updated: 2026-02-18
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

## Related

- TD-94: Missing Session Management flow doc
- [[InboxService]]
- Inbox mappers: `src/domain/inbox/mappers.ts`
