---
type: Requirement
status: open
priority: high
source: increment-review
iteration: 5
date: 2026-03-17
---

# RPG Agents — Interactive Waiting & Talk Engine Expansion

## Description

Agents in the RPG world should behave more interactively while waiting for the LLM to generate a response. Instead of standing idle or showing a static "thinking" bubble, agents should make small talk — ambient personality-driven chatter that fills the wait time and makes agents feel alive.

This requires improving and expanding the existing talk engine (`talk-engine.ts`) to support:
- Context-aware small talk triggered during LLM wait states
- Richer conversation variety tied to agent personality, mood, and current task
- Transition from small talk back to the LLM response when it arrives

## Acceptance Criteria

1. **Small talk during LLM wait** — When an agent is waiting for an LLM response, they produce periodic small talk bubbles (personality-driven, not random)
2. **Talk engine expansion** — Broader quote pools, context-aware selection (what task they're working on, their mood, their domain)
3. **Smooth transition** — When the LLM response arrives, small talk stops gracefully and the real response is presented
4. **No awkward silence** — The gap between sending a prompt and receiving a response should feel alive, not dead

## Rationale

The RPG world's value is in making agents feel present and alive. Dead waiting time breaks immersion. Small talk during LLM generation is the difference between "tool waiting for API" and "colleague thinking out loud."
