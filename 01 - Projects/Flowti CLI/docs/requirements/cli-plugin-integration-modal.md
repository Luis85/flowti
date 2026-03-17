---
type: Requirement
status: open
priority: high
source: increment-review
iteration: 5
date: 2026-03-17
---

# CLI-Plugin Integration Modal

## Description

Connect the Flowti Plugin and CLI so the Plugin becomes the visual shell for CLI operations. A modal inside the Obsidian plugin allows users to interact with the CLI directly, launch agents into dedicated plugin views, and start Storybook for projects that support it.

## Acceptance Criteria

1. **CLI interaction modal** — An Obsidian modal that provides an interface to the CLI, allowing users to trigger CLI commands from within the plugin
2. **Agent launch from plugin** — Start agents from the modal; each agent opens or is served in its own dedicated plugin view
3. **Storybook launch from plugin** — If a managed project has Storybook configured, the user can start it from within the plugin
4. **Baseline connectivity** — CLI and Plugin communicate bidirectionally (CLI executes, Plugin visualizes)

## Rationale

This is the "bang for the buck" — with this baseline set, the Plugin stops being a standalone tool and becomes the unified interface for all Flowti operations. Agents come alive in plugin views, Storybook is one click away, and CLI power is accessible without leaving Obsidian.
