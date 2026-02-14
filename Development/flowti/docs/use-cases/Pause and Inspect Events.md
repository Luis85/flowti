---
type: UseCase
domain: Flowti
stage: done
description: "Freeze the live feed to inspect entries while events continue buffering in the background"
view: "[[Event Log View]]"
feature: "[[Event System]]"
testplanRef: "UC-67"
tags:
  - use-case
  - log
---

# Pause and Inspect Events

## Summary

Use the Event Log's pause control to freeze the feed in place while inspecting specific entries. Events continue to be captured in a background buffer, so nothing is lost. When ready, resume the feed to see all accumulated events at once.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- The Event Log View is open and actively receiving events.
- Events are firing frequently enough that the feed is scrolling or updating faster than the user can read.

## Steps

1. Open the **Event Log View** and observe events arriving in the live feed.
2. Click the **Pause** button (or press the pause control) in the Event Log toolbar to freeze the feed.
3. Confirm that the feed stops updating and a visual indicator (e.g., a "Paused" badge or changed button state) shows the feed is frozen.
4. Scroll through the frozen feed and click on individual event entries to expand and inspect their payloads at your own pace.
5. While paused, trigger additional actions in Obsidian (e.g., save files, run commands) that produce new events. These events are collected in the background buffer.
6. When finished inspecting, click the **Resume** button to unfreeze the feed.
7. Observe that all events captured during the pause period appear in the feed, inserted in chronological order.

## Outcome

The user has inspected event entries without the feed scrolling away, and upon resuming, all events that occurred during the pause are visible with no data loss.

## Variations

- **Long pause duration**: If the user pauses for an extended period, a large batch of buffered events will appear on resume. The user can use the search bar to locate specific entries within the batch.
- **Pause during debugging**: Combining pause with "All" mode and search filtering provides the most thorough debugging workflow, allowing the user to freeze at the moment an issue occurs and examine all surrounding events.
- **Accidental resume**: If the user accidentally resumes, they can immediately pause again. Previously visible entries remain in the feed history.

## Related

- View: [[Event Log View]]
- Feature: [[Event System]]
- Test: UC-67 in [[Testplan and Teststrategy]]
