---
type: Idea
stage: delivered
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
delivered_in: C56
note: "Core PBIs delivered in C56: JB-008 (Canvas→JSON + bidirectional sync), JB-011 (Preview Run validation), JB-012 (Dual Input), JB-013 (Background Image). Polish items deferred: save-back (folded into canvas sync), drag-and-drop reorder (backlog), accordion sections (backlog), step reordering (backlog), canvas layout deduplication (TD-131, C57)."
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
