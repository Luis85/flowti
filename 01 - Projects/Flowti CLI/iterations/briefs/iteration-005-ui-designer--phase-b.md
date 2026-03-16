---
agent: UI Designer
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: UI Designer — Iteration #5 Phase B

## Your Role

You are the UI Designer for the ExcaliburJS RPG World. Your focus: agent character design (canvas-drawn), speech/thinking bubble design, setting theme palettes, and visual polish that gives each scene a distinct identity.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world
- **Phase**: B (RPG World)
- **End Date**: 2026-03-28

## Assigned Scope Items

### B3. Agent Visual Upgrade (lead)
- Design canvas-drawn character body: head (circle), torso (rounded rect), simple limbs
- Domain color scheme: engineering=blue (#3b82f6), design=purple (#a855f7), product=green (#22c55e), management=orange (#f97316)
- Mood indicator icon/emoji next to name
- Status badge (small dot: busy=green, idle=blue, working=yellow, talking=white)
- Idle breathing animation (subtle scale oscillation)
- Direction facing (horizontal flip on movement)

### B7. Speech & Thinking Bubbles (lead)
- Speech bubble: rounded rect with triangular tail, white background, dark text, shadow
- Thinking bubble: cloud shape (overlapping circles), "..." dots with cycling animation
- Size adapts to text length, auto-wraps at ~120px width
- Dismiss animation (fade out + float up)

### B10. Setting Themes (lead)
- **Office**: Cool grays (#1a1a2e, #2d2d44), accent blue (#3b82f6). Floor grid, fluorescent strips, potted plants (green circles), whiteboard, coffee machine
- **Village**: Warm earth (#2d1b0e, #4a3523), accent amber (#f59e0b). Cobblestone ground, grass edges, trees (triangles on sticks), torch lights (yellow glow), wooden signs
- **Station**: Deep blue (#0a0a2e, #1a1a3e), neon cyan (#06b6d4). Metal floor plates, glowing panel lines, starfield viewport, holographic displays, scanline effect

## Design Constraints

- Canvas-drawn only — no image assets, no sprite sheets
- ExcaliburJS `ExcaliburGraphicsContext` API: `drawCircle`, `drawRectangle`, `drawLine`, `save/restore`, `translate`, `scale`
- Keep character proportions consistent (28px head radius, ~60px total height)
- All text uses `system-ui, sans-serif` font family
- Dark backgrounds throughout — agents must pop against dark scenes

## Expected Output

- Color palette definitions per setting
- Character drawing specifications (shapes, sizes, colors)
- Bubble layout specifications (padding, tail angle, animation timing)
- Implementation in agent-actor.ts, speech-bubble.ts, and scene files
