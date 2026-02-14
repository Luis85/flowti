---
type: UseCase
domain: Flowti
stage: done
description: "Read contextual summaries attached to event entries such as watcher labels, file paths, error messages, and emitted domain event names"
view: "[[Event Log View]]"
feature: "[[Event System]]"
testplanRef: "UC-69"
tags:
  - use-case
  - log
---

# Review Enriched Context

## Summary

Certain event types in the Event Log display enriched context summaries inline, providing key information at a glance without needing to expand the full payload. Subscription matches show the watcher label, ingestion completions show the processed file path, failures show the error message, and definition matches show the emitted domain event name.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- The Event Log View is open and receiving events.
- At least one of the following features is active: subscriptions with named watchers, ingestion watchers on folders, event definitions that emit domain events, or operations that can fail.

## Steps

1. Open the **Event Log View** and set the mode to **"All"** (or ensure the relevant event types are subscribed).
2. Trigger a **subscription match** by modifying a file that matches an active subscription's filter. Locate the `subscription.matched` entry in the log and observe the inline **watcher label** displayed alongside the event type.
3. Trigger an **ingestion completion** by saving or creating a file in a watched folder. Locate the `ingestion.job.completed` entry and observe the inline **file path** of the processed file.
4. Trigger a **failure event** by providing invalid input to an import or by simulating an error condition. Locate the failure entry (e.g., `dataExchange.import.failed`) and observe the inline **error message** summary.
5. Trigger an **event definition match** by causing a source event that matches an active event definition. Locate the `eventDefinition.matched` entry and observe the inline **emitted domain event name**.
6. Compare the inline context summaries with the full expanded payloads to confirm they correctly highlight the most relevant information.
7. Use the enriched context to quickly triage events without expanding each entry, scanning the feed for specific watcher labels, file paths, or error messages.

## Outcome

The user can rapidly scan the Event Log feed and extract key operational details from enriched context summaries without needing to expand every entry, significantly speeding up monitoring and triage workflows.

## Variations

- **Missing context**: Not all event types have enriched summaries. Generic or custom events display only the event type and timestamp. The user can expand these entries to see the raw payload.
- **Long file paths**: File paths in context summaries may be truncated if they exceed the display width. Hovering or expanding the entry reveals the full path.
- **Multiple enrichment fields**: Some events may show more than one enriched field (e.g., an ingestion failure shows both the file path and the error message).

## Related

- View: [[Event Log View]]
- Feature: [[Event System]]
- Test: UC-69 in [[Testplan]]
