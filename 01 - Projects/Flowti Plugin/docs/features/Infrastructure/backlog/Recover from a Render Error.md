---
type: UseCase
domain: Flowti
stage: planned
description: When a view encounters a render error, the user sees a clear error message with a retry button instead of a blank panel.
view: "[[Event Catalog View]]"
feature: "[[Infrastructure PRD]]"
testplanRef: UC-97
tags:
  - use-case
  - infrastructure
  - error-recovery
---

# Recover from a Render Error

## Summary

A user has the Event Catalog or Data Exchange Hub open. Something goes wrong during rendering — a malformed frontmatter file, a missing catalog entry, or an unexpected payload shape. Instead of seeing a blank panel with no feedback, the user sees an error banner explaining what happened and offering a retry button.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The Event Catalog or Data Exchange Hub view is open.
- A condition exists that will cause a render error (e.g., malformed frontmatter in a doc file).

## Steps

1. **Navigate to a tab** — The user clicks a tab (e.g., Domains) that triggers a render method.
2. **Render fails** — The tab's `renderMaster()` or `renderDetail()` throws an exception (e.g., null dereference on a missing catalog entry).
3. **Error boundary catches the throw** — The orchestrator's try/catch wrapper catches the error before it propagates.
4. **Error banner appears** — The master panel displays a styled error banner with:
   - "Render error" heading
   - The error message (e.g., "Cannot read properties of undefined")
   - A "Retry" button
5. **Console log** — The full error (with stack trace) is logged to the console for debugging.
6. **User clicks Retry** — The user clicks the retry button. The orchestrator calls `scheduleRender()` to re-render the tab.
7. **Recovery or persistent error** — If the underlying issue is resolved (e.g., the bad file was fixed), the tab renders normally. If not, the error banner appears again.

## Outcome

The user is never left with a blank, unresponsive panel. They see a clear error message, can retry, and can use debug mode to investigate further. Other tabs remain functional.

## Variations

- **Error in detail panel only**: The master list renders correctly, but clicking an item fails in the detail panel. Only the detail side shows the error banner.
- **Transient error**: A race condition causes a one-time error. Clicking "Retry" succeeds immediately.
- **Multiple tabs affected**: If the underlying issue (e.g., corrupted storage) affects all tabs, each tab independently shows its error banner.

## Related

- Feature: [[Infrastructure PRD]]
- Tech Debt: [[TD-46 No error boundaries in views]]
- PBI: [[PBI-001 Plugin Reliability and Error Recovery]]
