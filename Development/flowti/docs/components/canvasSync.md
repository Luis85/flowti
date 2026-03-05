---
type: Component
domain: JourneyBuilder
stage: done
description: "Pure function — generates companion .canvas JSON from journey definition with left-to-right flow layout (START → Step groups → END)"
source: "[[Development/flowti/src/domain/journeyBuilder/canvasSync.ts|canvasSync.ts]]"
tags:
  - journey-builder
  - canvas
  - component
---

# canvasSync

## Description

canvasSync provides the pure function `buildJourneyCanvas()` that generates Obsidian-compatible canvas JSON from a journey definition. The layout follows a left-to-right flow: START circle (green) → step group nodes (with config text) → END circle. Each step group contains a config text node with step metadata. Edges connect nodes sequentially. Active step highlighting is supported via `activeStepIndex`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `generateCanvasId` | function | Obsidian-compatible 16-char hex IDs (from canvas domain) |
| `AllCanvasNodeData` | type | Obsidian canvas node type |
| `CanvasEdgeData` | type | Obsidian canvas edge type |

## Layout Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `NODE_W` | 160 | Circle node width |
| `NODE_H` | 80 | Circle node height |
| `GROUP_W` | 480 | Step group width |
| `GROUP_H` | 160 | Step group height |
| `GAP` | 40 | Horizontal gap between nodes |

## API

| Function | Purpose |
|----------|---------|
| `buildJourneyCanvas(input)` | Returns `{ nodes, edges }` canvas data from CanvasSyncInput |

## Input Shape

```typescript
interface CanvasSyncInput {
  journey: string;
  description: string;
  startEvent: string;
  endEvent: string;
  activeStepIndex?: number;
  steps: Array<{ id, title, description, actions }>;
}
```

## Related

- Service: [[JourneyBuilderService]]
- Canvas domain: `src/domain/canvas/CanvasRebuilder.ts` (generateCanvasId)
- Test: `tests/domain/journeyBuilder/canvasSync.test.ts` (34 tests)
- Source: `src/domain/journeyBuilder/canvasSync.ts` (153 LOC)
