---
type: Idea
stage: planned
origin: cycle-retro
domain: journey-builder
parent: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
description: Complete the Journey Builder with bidirectional canvas sync, preview run, and authoring polish from C55 retrospective.
tags:
  - journey-builder
  - canvas
  - e2e
priority: 01 - medium
planned_in: C56
delivered_in:
note: "Items from C55 retrospective improvement backlog. PBI-JB-008 (Canvas→JSON), PBI-JB-011 (Preview Run), PBI-JB-012 (Dual Input). Plus: save-back to source, drag-and-drop reorder, accordion sections, step reordering, canvas layout deduplication."
---
# Journey Builder Phase 2 — Canvas Round Trip and Preview Run

Captured from Cycle 55 retrospective. These items complete the Journey Builder's bidirectional authoring loop and add the live preview capability.

## Core PBIs (from PRD)
- **PBI-JB-008**: Canvas → JSON conversion — parse canvas nodes/edges into JourneyDefinition
- **PBI-JB-011**: Preview Run — execute journey within Obsidian, canvas updates live (pass/fail per step)
- **PBI-JB-012**: Dual Input for Journey Runner — accept both .journey.json and .canvas files

## Polish from C55 Retrospective
- Save-back to source file with dirty tracking (edit-in-place instead of re-export)
- Drag-and-drop action reordering
- Accordion collapse/expand for step sections
- Step reordering (move step up/down)
- Canvas layout deduplication (canvasSync.ts ↔ generate-e2e-report.mjs)
