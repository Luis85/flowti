---
type: TechDebt
severity: medium
category: documentation
layer: flows
status: open
effort: medium
updated: 2026-02-18
description: 18+ session events exist in the catalog but no Session Management flow doc or integration test covers the full session lifecycle.
---
# TD-94: Missing Session Management flow doc and integration test

## Problem

The Session Workspaces domain emits 18+ events (`session.create`, `session.started`, `session.paused`, `session.resumed`, `session.completed`, `session.archived`, `session.activity.logged`, `session.context.*`, `session.template.*`, `session.workspace.*`, etc.) but no flow document traces the end-to-end session lifecycle. Every other major domain (Import, Export, Subscription, Ingestion, Event Definition) has a corresponding flow doc and integration test in `tests/flows/`.

Without a flow doc, new contributors cannot understand the intended event sequence, and there is no integration test verifying the full session lifecycle from creation through completion.

## Impact

- No single document describes the session lifecycle event sequence
- No integration test verifies the full session event chain
- Onboarding to the Session Workspaces domain requires reading the source code directly
- Regression risk: session event chain could break without test coverage

## Suggested Remediation

1. Create `docs/flows/Create and Manage Sessions.md` following the existing flow doc template
2. Cover: session.create → session.started → session.paused/resumed → session.completed → session.archived
3. Include activity logging, context bindings, and workspace state side-flows
4. Create `tests/flows/session-management.flow.test.ts` integration test

## Related

- TD-95: Missing Inbox Management flow doc
- [[Session Workspaces PRD]]
- [[PBI-SW-001 Activity Log]]
