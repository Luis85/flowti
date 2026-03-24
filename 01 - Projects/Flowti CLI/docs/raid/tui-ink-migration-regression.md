---
type: RAID
category: issue
severity: critical
status: closed
resolution: TUI dropped by design — Plugin is sole UI. No regression.
source: increment-review
iteration: 5
date: 2026-03-17
---

# TUI Ink Migration — Missing Functionality

## Description

The migration to the Ink framework for the CLI's TUI lost existing functionality:

1. **Project management features** — previously available project views/actions are missing
2. **Agent launch** — cannot start agents from the TUI anymore
3. **Storybook launch** — cannot start Storybook from the TUI anymore

## Impact

Core CLI interactive workflows are broken. Users must fall back to non-interactive CLI commands for functionality that was previously available in the TUI.

## Suggested Investigation

1. Audit sitemap.json actions vs registered Ink handlers — identify which actions lost their handler bindings
2. Check if agent:run, agent:run-brief, storybook:start actions are registered in the new Ink handler system
3. Verify project-related menu items are wired up in the new UI layer
