---
type: Idea
stage: discovery
origin: inbox
domain: session
description: "A guided pre-session checklist ensures goals are set, context is loaded, and artifacts are prepared before starting work."
tags: []
priority: "01 - medium"
rank:
related:
  - "[[Every Cycle gets checked with Definition of Ready and Definition of Done]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Process ceremony helps not forget crucial steps. Before a session starts, a checklist (Definition of Ready for Sessions) ensures: (1) goals are defined, (2) context notes are loaded, (3) canvas/artifacts are prepared, (4) previous session reflection is reviewed. This guided workflow brings structure to artifact production and ensures the knowledge graph captures the full context."
---

## Problem

Sessions can be started without preparation, leading to unfocused work and missing context. Crucial steps like reviewing previous session reflections or setting clear goals get skipped.

## Proposed Solution

1. **Pre-session checklist**: Configurable per session type
2. **Default checklist items**:
   - [ ] Goals defined (at least 1)
   - [ ] Context notes attached
   - [ ] Previous session reflection reviewed
   - [ ] Canvas/artifacts prepared (for canvas sessions)
   - [ ] Time estimate set
3. **Guided flow**: Checklist presented in session creation modal before "Start"
4. **Template-based**: Each session template can define its own preparation checklist
5. **Skip option**: Power users can bypass with "Start anyway"
