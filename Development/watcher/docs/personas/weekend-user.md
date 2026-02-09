# Persona: The Weekend User

> Used in: [Journey 3 — Catch Up After a Weekend Away](../journeys/journey-3-catch-up-after-weekend.md)

## Profile

| | |
|---|---|
| **Name** | Jordan |
| **Role** | Project manager / knowledge worker |
| **Tech level** | Basic — uses Obsidian for notes, expects things to "just work" |
| **Platform** | Windows 10 |

## Context

Jordan uses Obsidian at work with multiple folder mappings (notes, docs, shared team files). Over the weekend, Dropbox accumulates changes from colleagues. On Monday morning, Jordan opens Obsidian and expects everything to be up to date — without clicking buttons or running manual syncs.

## Goals

- Open Obsidian on Monday and have all weekend changes synced automatically
- Unchanged files should be skipped quickly (no waiting for full re-sync)
- See progress while reconciliation runs (how many files left?)
- Be able to cancel if it takes too long

## Pain Points

- Waiting minutes for a full re-sync when only 5 files actually changed
- No feedback during reconciliation — is it stuck or working?
- Accidentally triggering a second reconcile while the first is still running
- Disabled mappings being reconciled when they shouldn't be

## Jobs to be Done

See [weekend-user JTBD](../jtbd/weekend-user.md)

## Primary Features

| Feature | Why it matters |
|---------|---------------|
| [Reconciliation](../features/feature-05-reconciliation.md) | `syncOnStart` + incremental mode |
| [Persistence](../features/feature-10-persistence.md) | Sync state remembers mtime/size for fast skip |
| [UI](../features/feature-09-ui.md) | Progress reporting, dashboard, status bar |
| [Settings](../features/feature-08-settings.md) | Enable/disable mappings, `reconcileOnStart` per mapping |
| [Reliability](../features/feature-06-reliability.md) | Concurrent guard, retry on transient errors |
