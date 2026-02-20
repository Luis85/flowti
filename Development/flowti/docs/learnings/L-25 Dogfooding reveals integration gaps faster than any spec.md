---
type: Learning
cycle: 10
domain: meta
tags:
  - dogfooding
  - integration
---

# L-25: Dogfooding reveals integration gaps faster than any spec

## Context

During the current iteration, several integration gaps were identified not through formal specification review, but through daily use of the system. Work happening outside Flowti (quick notes in other apps, feedback captured in chat, ideas jotted on paper) highlighted that the system lacks low-friction capture mechanisms.

## Observation

The knowledge graph only grows when data enters the system. Every piece of work done outside the system is invisible — it cannot be measured, linked, or learned from. The gap between "what we do" and "what the system knows about" is the integration debt.

## Takeaway

Prioritize integrations that reduce the friction of getting data *into* the system. Quick capture, auto-documentation, and file event linking are higher leverage than building new analysis views for data that doesn't exist yet.

## Applied

- Created quick capture ribbons item (high priority)
- Created session auto-documentation item
- Elevated dogfooding meta-concern to high priority
