---
type: ProductBacklogItem
feature: "[[Train Improvements PRD]]"
stage: done
delivered_in: "[[Cycle 24 - Train Value Sprint]]"
priority: high
effort: high
dependencies:
  - "[[PBI-TOT-010 Train Hub]]"
user_story: "[[Train Improvements]]"
planned_in: "[[Cycle 24 - Train Value Sprint]]"
note: "Jump-to-end, smart resume, frontmatter enrichment, train types. Cycle 24 Inc 2-5."
tags:
  - backlog
  - train-of-thought
  - ux
---

## User Story — Problem Space

As a Train of Thoughts user, I want smarter navigation when resuming trains (jump to end vs branch from current position), the ability to edit thought properties from the detail view, and a way to choose a train type at creation so that each train has an appropriate default duration and visual identity.

### User Pains

- When resuming a train from a mid-chain node, user must click through every node to reach the head before adding new thoughts
- No "Jump to end" button — navigating long trains is tedious
- Can't edit thought note frontmatter without opening the file in the editor
- All trains look the same — no type selection at creation, no visual distinction between brainstorm, research, and decision trains

### User Needs

- "Jump to end" button in detail view when not on the head node
- Smart resume modal: "Jump to end" vs "Branch from here" vs "Stay here" when resuming mid-chain
- Inline property editor on the thought detail page
- Train type selection at creation with built-in types (brainstorm, research, decision, free-form)
- Type badge visible in Train Hub and detail view

## Solution Statement

### Functional Requirements

- [x] FR-17: `getHeadNode(trainId)` — returns last main-chain thought
- [x] FR-18: Jump-to-end button in TrainMainView nav bar (visible when not on head)
- [x] FR-19: Smart resume modal with 3 options (jump to end, branch from here, stay)
- [x] FR-20: Inline frontmatter property editor on thought detail section
- [x] FR-21: Built-in train types with `TrainTypeConfig` (brainstorm, research, decision, free-form)
- [x] FR-22: Type picker modal before train creation
- [x] FR-23: Type badge in detail view header and Train Hub list

### Key Design Decisions

- **`getHeadNode()` is a graph utility** — pure function walking main chain via "next" relations, returns last node
- **Resume modal skips when on head** — common case (resuming from where you left off) is not interrupted
- **Property editor uses `processFrontMatter()`** — Obsidian's built-in frontmatter API, debounced at 500ms
- **Built-in types only** — no custom type creation in v1; extensibility deferred
- **`trainType` is optional on TrainState** — backward compatible; existing trains default to "free-form"

### INVEST Assessment

- **I**ndependent: Jump-to-end, frontmatter, and types are independent of each other
- **N**egotiable: Number of built-in types, resume modal options, property editor scope
- **V**aluable: Jump-to-end is high UX impact; types address direct user request
- **E**stimable: 4 sub-increments, ~500 LOC total, ~50 tests
- **S**mall: Each sub-increment is 1 vertical slice
- **T**estable: Service methods testable in isolation; modals testable via DOM assertions

## Related

- [[Train Improvements PRD]] (v2, FRI 28/35)
- [[Cycle 24 - Train Value Sprint]] Inc 2-5
- [[PBI-TOT-010 Train Hub]] — prior PBI in same cycle
- Inbox: [[I want to choose a type of train at the beginning of a new one]], [[I want to enrich the frontmatter of train-of-thought notes on the detail page]], [[The session complete view needs to be adjusted when coming from a train]]
