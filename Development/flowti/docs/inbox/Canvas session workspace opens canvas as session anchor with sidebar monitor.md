---
type: Idea
stage: planned
origin: inbox
domain: session
parent: "[[Obsidian Canvas Integration PRD]]"
pbi: "[[PBI-CAN-003 Canvas Sessions]]"
description: "Start a Canvas Session that opens a preconfigured canvas in main and the session workspace in sidebar, making the canvas the core anchor during the session."
tags: []
priority: "2 - high"
rank:
related:
  - "[[Starting a Canvas Session]]"
  - "[[Canvas importer must be a first-class plugin feature]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Evolves the existing 'Starting a Canvas Session' inbox item. Canvas files are JSON with nodes, edges, and groups — they map naturally to domain entities. A canvas session opens: (1) session monitor in sidebar for timer, goals, notes; (2) preconfigured canvas in main pane with ready-made groups based on session type."
---

## Problem

Sessions currently open as a standalone workspace view. There is no way to anchor a session around a canvas, which is the natural medium for visual domain design, brainstorming, and flow mapping. Work done on canvas during a session is disconnected from session artifacts.

## Proposed Solution

1. **Canvas Session type**: New session type that opens:
   - Session Workspace in **sidebar** (timer, goals, reflection, activity)
   - Preconfigured canvas in **main pane**

2. **Canvas template per session type**: Domain Design canvas has groups for Actors, Systems, Events, Services. Sprint Planning has groups for Backlog, Sprint, Done.

3. **Auto-link**: Canvas file is automatically attached as session artifact. Nodes created during session get `session` frontmatter reference.

4. **Post-session import**: At session close, offer to import canvas nodes as typed notes (using canvas importer).

## Acceptance Criteria

- [ ] "New Canvas Session" option in session creation modal
- [ ] Canvas opens in main pane with sidebar session monitor
- [ ] Canvas template applied based on session type
- [ ] Canvas file linked as session artifact
- [ ] Post-session import prompt for canvas nodes
- [ ] `npm run build` passes


---
> [!merged] Merged from: Canvas should be the leading interface for sessions.md
> This vague direction note is now consolidated into the concrete PBI-CAN-003 spec.
