---
type: KnowledgeBase
domain: Flowti
stage: done
description: The 11 capture types, keyboard shortcuts, and how captures flow to the inbox.
tags:
  - tutorial
  - capture
  - inbox
---

# Using Quick Capture

> Quick Capture lets you get an idea out of your head and into your vault in seconds. This tutorial covers the 11 capture types, how to use them, and where captured items end up.

---

## Why Quick Capture?

You are in the middle of something — reading a note, reviewing a dashboard, sitting in a meeting — and an idea strikes. You do not want to lose it, but you also do not want to break your flow. Quick Capture is the answer.

It opens a lightweight modal where you type a title, optionally add a description, and choose a type. One press of Enter and the note is created. You are back to what you were doing in under five seconds.

Quick Capture is not a replacement for [[Working with Sessions|focused sessions]] or [[Using the Train of Thought|trains of thought]]. It is a safety net for the small, fleeting things that would otherwise be forgotten.

---

## The 11 Capture Types

Each capture type creates a note with a specific `type` property in its frontmatter. This makes captured items easy to find, filter, and query later.

| Type | Icon | Use It For |
|------|------|-----------|
| **Idea** | Lightbulb | A new concept, possibility, or inspiration |
| **Note** | File | A general observation or piece of information |
| **Task** | Checkbox | Something that needs to be done |
| **Question** | Help circle | Something you need an answer to |
| **Feedback** | Message | An observation about a process, tool, or workflow |
| **Bug** | Bug | A problem or defect you noticed |
| **Risk** | Warning | Something that might go wrong |
| **Assumption** | Compass | A belief that should be validated |
| **Issue** | Alert | A current problem that needs resolution |
| **Decision** | Scale | A choice you made, with its rationale |
| **Learning** | Graduation cap | An insight or lesson learned |

You do not need to agonize over which type to choose. Pick the one that feels closest. The type is a hint for future filtering, not a rigid classification.

---

## How to Capture

### The General Quick Capture

Open the command palette and search for **Quick capture**. A modal appears with:

1. A **type dropdown** — select from the 11 types (defaults to Idea)
2. A **title field** — give your capture a short, descriptive name
3. An optional **description field** — add context if you have time
4. Press Enter or click the button to save

The note is created instantly in your configured capture folder.

### Type-Specific Commands

If you already know the type, you can skip the dropdown and go straight to a dedicated command. Each type has its own command in the palette:

- **Add idea**
- **Add note**
- **Add task**
- **Add question**
- **Add feedback**
- **Add bug**
- **Add risk**
- **Add assumption**
- **Add issue**
- **Add decision**
- **Add learning**

These commands open the same modal but with the type pre-selected, saving you one step.

---

## Where Do Captures Go?

Captured notes are created in the **inbox folder** configured in your Flowti settings. By default, this is a dedicated folder that acts as a landing zone for everything you capture.

Think of the inbox as a triage area. Items arrive here fast and unprocessed. Later — during a [[Working with Sessions|session]], perhaps — you review them, move them to the right place, link them to domains, or act on them.

The inbox is visible in the **User Hub**. Open the command palette and search for **Open user hub** to see your pending inbox items and work through them at your own pace.

---

## The Capture Workflow

A healthy capture workflow looks like this:

1. **Capture freely.** Do not hesitate. If something comes to mind, capture it. Speed matters more than perfection at this stage.
2. **Review regularly.** Set aside a few minutes each day — or use a session — to go through your inbox. For each item:
   - Is it still relevant? If not, archive or delete it.
   - Does it belong to a domain? Move it or link it.
   - Is it actionable? Turn it into a task with a clear next step.
   - Is it a question? Find the answer and document it.
3. **Connect the dots.** As you review captures, you will notice patterns. Three ideas about the same process? That is a signal to start a [[Using the Train of Thought|train]] or a documentation session on that topic.

The goal is to keep the inbox flowing. Captures come in, get processed, and move to their permanent home. A stagnant inbox is a sign that your capture rate has outpaced your review rate — time to schedule a short review session.

---

## Nudges for Inbox Review

Flowti can remind you to check your inbox with gentle **nudges** — timed notifications that appear at specific times of day. If you have a morning review nudge configured, Flowti will prompt you to look at your inbox when you start your day.

Nudges are optional and fully configurable. They are there to support your practice, not to nag.

---

## Tips for Effective Capturing

**Write titles that stand alone.** When you review your inbox tomorrow, "Better error handling in the import wizard" is much more useful than "idea about errors."

**Use the description sparingly.** A few sentences of context is plenty. If you find yourself writing a full paragraph, consider starting a [[Using the Train of Thought|train]] instead.

**Assign types honestly.** A question is different from an idea. A risk is different from a bug. The more accurately you type your captures, the more useful they become when you filter and query them later.

**Do not capture what you can do now.** If something takes less than two minutes, just do it. Quick Capture is for things that need to wait — not for things you are avoiding.

**Review your captures with analytics.** Once you have been capturing for a while, create a [[Creating Analytics Queries|query]] to see how many items you capture per week, which types dominate, and how quickly items move out of the inbox. The patterns will surprise you.

---

## Next Steps

- [[Working with Sessions]] — Use a session to review and process your inbox
- [[Using the Train of Thought]] — For when a single capture is not enough
- [[Building Dashboards]] — Track your capture activity over time
