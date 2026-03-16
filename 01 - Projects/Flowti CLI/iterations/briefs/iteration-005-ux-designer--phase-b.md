---
agent: UX Designer
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: UX Designer — Iteration #5 Phase B

## Your Role

You are the UX Designer for the ExcaliburJS RPG World. Your focus: the click-to-interact flow, interaction panel layout, task assignment UX, and ensuring the world feels intuitive to navigate.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world
- **Phase**: B (RPG World)
- **End Date**: 2026-03-28

## Assigned Scope Items

### B6. Click-to-Interact System (lead)
- Interaction flow: click agent → panel appears above head → choose action → execute → panel closes
- Panel layout: agent identity (name, persona, role, domain) at top, mood + personality as subtext, attribute bars (STR/INT/WIS/CHA/DEX/CON as mini horizontal bars), action buttons at bottom
- Action buttons: Talk (opens chat input), Assign Task (opens task list), View Stats (detailed attributes), Close (X button)
- Only one panel at a time — clicking another agent switches panel
- Panel positioned above agent head, clamped to viewport edges
- Escape key or click-outside dismisses panel

### B8. Task Assignment from World (co-lead)
- Task list: shows agent's `suggestedTasks`, grouped by relevance to current phase
- Each task is a button with name — click to assign
- After assignment: panel closes, agent walks to workstation, thinking bubble appears
- Completion: speech bubble "Done: {task}!", agent returns to wandering
- Visual feedback: button highlights on hover, disabled if agent already working

## UX Constraints

- Panel is HTML overlay (not ExcaliburJS) — standard CSS, accessible, responsive
- Must work with mouse only (no keyboard required for interaction panel)
- Attribute bars should communicate at a glance (color-coded, fixed scale 1-20)
- Task list should not overwhelm — max 6 visible, scroll if more

## Expected Output

- Interaction panel HTML/CSS design
- Click flow specification
- Task assignment UX flow
- Implementation in interaction-panel.ts and task-panel.ts
