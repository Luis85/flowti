---
type: Learning
cycle: 10
domain: session
tags:
  - canvas
  - session
---

# L-27: Canvas files are natural session anchors

## Context

Obsidian canvas files are JSON documents with nodes, edges, and groups. The existing canvas importer scripts already map these structures to domain entities: groups become domains/containers, nodes become typed items (events, actors, tasks), and edges become relationships.

## Observation

Canvas files are inherently visual, spatial, and relational — the same qualities needed for session work like domain design, sprint planning, and brainstorming. A canvas session (sidebar monitor + main canvas) combines the structure of sessions with the freedom of visual thinking.

## Takeaway

Canvas integration is not a "nice to have" — it bridges the gap between visual thinking and structured documentation. The import path (canvas nodes -> typed notes) closes the loop: think visually during the session, capture structurally afterward. This makes canvas files the natural anchor for creative and design sessions.

## Applied

- Elevated canvas session item from low to high priority
- Created canvas importer as plugin feature item (release blocker RB-3)
- Created canvas template library item for session types
