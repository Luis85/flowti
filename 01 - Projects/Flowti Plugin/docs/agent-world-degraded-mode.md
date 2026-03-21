# Agent World — working without LLM / CLI

The **Agent World** view is designed to stay usable when optional dependencies are missing or misconfigured.

## What works without any subprocess

- **Excalibur canvas**: scenes, movement, brain state machine, needs/mood, pets, ambient **Talk engine** (template thought bubbles), particles, day cycle, Ask Bob **World** tab (vault-driven narrative), and most **Monitor** / **Info** data that comes from vault JSON + simulation.

## What needs the Flowti CLI host

- **Talk tab** (per-agent LLM chat), **CLI-backed tasks**, **permissions** handoff to the real agent process, and **process metrics** (PID/RAM/CPU) require:
  - Node on `PATH`
  - Flowti CLI bundle under the vault (e.g. `.flowti/bin/main.mjs`)
  - For **AI** roster agents, whatever **LLM CLI** your vault/agents expect (often Claude Code or similar) installed where that subprocess runs

If agents are configured for Claude but it is not installed, you may see: no text in Talk after sending, **Thinking…** stuck, or `[error]` / `[offline]` lines once the CLI fails. The UI now uses **timeouts** and clearer banners so the panel is not a blank void.

## Human vs AI agents

Roster entries with `agentType` other than `ai` (e.g. human) are **not** LLM-backed. The Talk tab explains that and disables send — the canvas still animates them.

## Hardening implemented in the plugin

| Area | Behavior |
|------|----------|
| **Talk tab** | Visible banners for CLI down, LLM reminder, and simulation-only agents; empty state explains canvas liveliness. |
| **Store** | **120s watchdog** after send or `thinking` event: posts a timeout message, sets LLM error, clears spinner. |
| **Failures** | `sendMessage` / task / spawn failures always append an **`[offline]`** or **`[error]`** agent turn (including the previously silent “failed to start process” path). |
| **`pushAgentResponse`** | Optional `{ llmState: "error" }` so failed paths show red error badge instead of flipping to idle. |

## Configuration tips

- Align vault agent tooling with what you actually install (don’t point everyone at Claude if you only run local models).
- Use **human** `agentType` for pure decorative characters when you never intend to spawn a CLI session.

See also: `docs/agent-world-architecture.md`, `docs/agent-world-performance.md`.
