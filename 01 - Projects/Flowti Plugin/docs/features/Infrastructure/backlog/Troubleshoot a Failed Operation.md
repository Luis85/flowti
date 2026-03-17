---
type: UseCase
domain: Flowti
stage: done
description: When a plugin operation fails, the user sees a notification toast and can enable debug mode to trace the full event flow.
view: "[[Event Catalog View]]"
feature: "[[Infrastructure PRD]]"
testplanRef: UC-98
tags:
  - use-case
  - infrastructure
  - error-handling
---

# Troubleshoot a Failed Operation

## Summary

A user performs an action (e.g., creating a domain doc, importing CSV data) and it fails. The plugin shows a toast notification with the error. The user enables debug mode in Settings to trace the event flow and identify where the failure occurred.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The user is performing an operation that can fail (file creation, import, export, etc.).

## Steps

1. **Trigger the operation** — The user clicks "+" to create a new domain doc, or starts a CSV import.
2. **Operation fails** — The file system rejects the write (e.g., path too long, disk full), or a service error occurs.
3. **Toast notification appears** — An Obsidian Notice appears with the error message (e.g., "Failed to create file: path exceeds maximum length").
4. **Error event emitted** — `error.occurred` fires with the full `FlowtiErrorInfo` payload (code, message, category, severity, context, timestamp).
5. **User enables debug mode** — The user opens Settings > Debug Mode and toggles it on.
6. **Retry the operation** — The user retries the same action. This time, the console shows the full event trace:
   - `file.create.request` with the path and content
   - `error.occurred` with the failure details
   - Any retry or fallback events
7. **User identifies the issue** — From the trace, the user sees the exact request that failed and why.
8. **User fixes the root cause** — The user corrects the issue (e.g., shortens the path) and retries successfully.

## Outcome

The user has a clear diagnostic path: toast → debug mode → event trace → root cause. No guessing required.

## Variations

- **Intermittent failure**: The operation succeeds on retry. The user checks the trace to understand what was different.
- **Service-level error**: An `errorService.wrap()` catches the error and provides a fallback. The user sees a warning toast but the operation partially succeeds.
- **Already in debug mode**: If debug mode is already on, the trace is immediately available in the console.

## Related

- Feature: [[Infrastructure PRD]]
- PBI: [[PBI-001 Plugin Reliability and Error Recovery]]
