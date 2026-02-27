---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to create an event definition note in the vault, what frontmatter fields matter, and how file events become domain events.
tags:
  - tutorial
  - events
  - event-definition
---

# Creating Your First Event Definition

> Event definitions are the bridge between raw file activity and meaningful domain events. This tutorial walks you through creating one from scratch.

---

## What Is an Event Definition?

Every time a file is created, modified, or deleted in your vault, Flowti notices. These are **system events** — useful, but generic. An event definition tells Flowti how to interpret a specific file event and translate it into a **domain event** with a name that means something to your business.

For example:

- A file appears in `reports/daily/` — the system sees `file.created`. Your event definition transforms this into `report.daily_received`.
- A note is updated in `contracts/active/` — the system sees `file.modified`. Your definition transforms this into `contract.updated`.

Without event definitions, the system only knows that files changed. With them, it understands what those changes mean.

---

## When Do You Need One?

You need an event definition when:

- You receive files from external sources (reports, exports, data drops) and want the system to recognize them
- You want dashboards or the Event Catalog to reflect business-level activity rather than raw file operations
- You want to track patterns — how often a certain type of file arrives, when it last appeared, or whether it stopped coming

If you are just writing notes by hand, you may not need event definitions right away. They become valuable when your vault starts receiving structured, repeatable data.

---

## Anatomy of an Event Definition

Each event definition has a few key fields:

| Field | What It Means |
|-------|--------------|
| **Source event type** | The system event to listen for, such as `file.created` or `file.modified` |
| **File pattern** | An optional glob pattern to narrow the match — e.g., `reports/daily/*.md` |
| **Domain event name** | The meaningful name to emit — e.g., `report.daily_received` |
| **Payload mappings** | Rules for extracting data from the file path or metadata and attaching it to the event |
| **Emission policy** | Whether to fire once per file (`once`) or every time (`always`) |
| **Enabled** | A simple toggle to activate or deactivate the definition |

The **emission policy** is worth understanding. If set to `once`, the system remembers that it already fired for a particular file and will not fire again. This is useful for arrival events. If set to `always`, it fires every time the source event matches — useful for tracking ongoing changes.

---

## Creating a Definition Step by Step

1. Open the command palette and search for **Open event catalog**
2. Navigate to the **Event Definitions** section
3. Click **+** to create a new definition
4. Fill in the fields:
   - **Source event type** — Choose `file.created` (most common for arrival events)
   - **File pattern** — Enter a path pattern like `reports/weekly/*.md`
   - **Domain event name** — Give it a clear name: `report.weekly_received`
   - **Emission policy** — Choose `once` if each file should trigger the event only once
5. Add **payload mappings** if you want to extract data from the file. For example, you can pull the file name, a date from the path, or a metadata field from the note's frontmatter
6. Toggle **Enabled** to on
7. Save the definition

From this moment forward, every time a markdown file appears in `reports/weekly/`, the system will emit `report.weekly_received` as a domain event. The Event Catalog will show it. Dashboards can track it. The system understands what just happened.

---

## Understanding Payload Mappings

Payload mappings let you attach structured data to the emitted event. Each mapping has three parts:

- **Field** — the name of the output field (e.g., `reportDate`)
- **Source** — where the value comes from: `path` (from the file path), `metadata` (from frontmatter), or `derived` (computed by the system)
- **Expression** — the extraction rule (a regex group name for path sources, a frontmatter key for metadata sources)

For example, if your files follow the pattern `reports/weekly/2026-02-27 Sales.md`, you could extract the date from the path and attach it as `reportDate` on the domain event.

You do not need payload mappings for every definition. Start simple — just the domain event name is enough. Add mappings later when you want richer data on your events.

---

## Viewing Your Events

Once your definition is active and a matching file appears, you can see the result in several places:

- The **Event Catalog** will list your new domain event under the Events tab
- The **Event Log** (open via the command palette with **Open event log**) shows a live stream of all events, including your new domain events
- Any [[Building Dashboards|dashboard]] that queries event data will pick up the new event automatically

---

## Tips for Good Definitions

**Name events in past tense.** Use `report.received` rather than `report.receive`. Events describe things that already happened.

**Keep file patterns specific.** A pattern like `*.md` will match every markdown file in your vault. Be as narrow as you can — `reports/daily/*.md` is much better.

**Start with "once" policy.** You can always switch to "always" later. The "once" policy prevents duplicate events if the same file is modified repeatedly.

**Test with a single file.** Create or drop one file that matches your pattern and check the Event Log to confirm the domain event fires correctly.

---

## Next Steps

- [[Understanding Domains and Events]] — Learn more about the domain model
- [[Creating Analytics Queries]] — Query your domain events for insights
- [[Building Dashboards]] — Visualize event activity over time
