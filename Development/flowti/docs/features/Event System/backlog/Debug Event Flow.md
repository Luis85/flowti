---
type: UseCase
domain: Flowti
stage: done
description: "Switch to All mode, search by pattern, and expand entries to inspect payloads for debugging"
view: "[[Event Log View]]"
feature: "[[Event System PRD]]"
testplanRef: "UC-66"
tags:
  - use-case
  - log
---

# Debug Event Flow

## Summary

Switch the Event Log to "All" mode to observe every event in the system, use the search bar to narrow results by event type pattern, and expand individual entries to inspect their full payloads. This workflow is essential for understanding event ordering and diagnosing unexpected behavior.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- The Event Log View is open.
- The user has a specific issue or behavior to investigate (e.g., an import that silently failed, or events firing in an unexpected order).

## Steps

1. Open the **Event Log View** and switch the mode selector from "Subscribed" to **"All"**.
2. Observe that the feed now displays every event fired in the system, including system-level and lifecycle events.
3. Type a pattern into the **search bar** at the top of the feed (e.g., `dataExchange.import` to filter for all import-related events, or `ingestion` for ingestion pipeline events).
4. Review the filtered list to identify the sequence of events that occurred. Note the timestamps to understand the ordering and timing between events.
5. Click on a specific event entry to **expand** it, revealing the full event payload in a formatted view.
6. Inspect the payload fields (e.g., file paths, error messages, configuration values) to identify the root cause of the issue.
7. Optionally, refine the search pattern to trace related events (e.g., search for a specific file path that appeared in a payload to find all events referencing that file).
8. Once the issue is understood, switch back to "Subscribed" mode to resume normal monitoring.

## Outcome

The user has identified the sequence and content of events related to their issue, giving them the information needed to diagnose the root cause and determine a fix.

## Variations

- **Broad search**: Using a short pattern like `error` or `fail` to find all failure-related events across domains.
- **Empty results**: If the search returns no results, the event type may not have fired yet. Reproduce the issue and watch for new entries.
- **Large payloads**: Some events carry extensive payloads. The expanded view may require scrolling. Key fields are shown first for quick scanning.

## Related

- View: [[Event Log View]]
- Feature: [[Event System PRD]]
- Test: UC-66 in [[Testplan and Teststrategy]]
