---
type: Requirement
status: open
priority: high
source: increment-review
iteration: 5
date: 2026-03-17
---

# Plugin Skill Execution — AI Agent Skills from Obsidian

## Description

Users can trigger AI Agent skills directly from the Flowti Plugin. A ribbon icon or button launches a skill picker. The selected skill is executed on a connected LLM through the Flowti CLI. The CLI and Plugin communicate responses bidirectionally. The Plugin provides an interactive modal for the user to follow along, see output, and answer the model's questions.

## Flow

1. User clicks ribbon icon / button in Obsidian → skill picker opens
2. User selects a skill (e.g., "brainstorming", "debugging", "code review")
3. Plugin sends skill execution request to the embedded CLI
4. CLI connects to the LLM and begins skill execution
5. CLI streams responses back to Plugin
6. Plugin displays output in an interactive modal
7. When the LLM asks a question, the modal presents it and lets the user respond
8. User responses are sent back through CLI to the LLM
9. Cycle continues until the skill completes

## Acceptance Criteria

1. **Ribbon / button trigger** — visible, easy-to-find entry point for skill execution
2. **Skill picker** — lists available skills from the agent roster / skill map
3. **CLI-Plugin communication** — bidirectional streaming of LLM output and user input
4. **Interactive modal** — displays LLM output, presents questions, accepts user input
5. **Conversation continuity** — full back-and-forth until skill completes
6. **Output persistence** — skill execution results are saved (session, transcript, or artifact)

## Rationale

This closes the loop between the agent ecosystem and the user. Skills are already defined, agents have skill maps, the CLI can execute them. The missing piece is letting the user trigger and interact with skills without leaving Obsidian. The modal becomes the human-in-the-loop interface for AI-driven workflows.
