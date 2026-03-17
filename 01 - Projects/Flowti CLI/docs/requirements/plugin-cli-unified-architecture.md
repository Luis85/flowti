---
type: Requirement
status: open
priority: critical
source: increment-review
iteration: 5
date: 2026-03-17
---

# Plugin-CLI Unified Architecture

## Architectural Decision

**The Flowti CLI is the orchestrator. The Flowti Plugin is the user interface on top of it.**

The Plugin bundles the CLI — every Plugin build copies the latest CLI build. The CLI provides all features; the Plugin provides the visual experience. This is the foundational relationship going forward.

## Requirements

### 1. CLI Bundling

- Plugin build step copies the latest CLI build artifact into the plugin bundle
- Plugin always ships with a matching CLI version
- No external CLI installation required — it's embedded

### 2. Flowti CLI View (Main Entry Point)

A dedicated Obsidian view that is the main user interface for working with the CLI:

- **CLI Hub** — easy-to-access features, the primary entry point
- **Raw terminal tab** — emulates a terminal for direct CLI interaction ("raw" mode)
- **Agents Hub** — agent management, launch, monitoring
- **Projects Hub** — project management, build, test, reports
- All CLI output displayed in this dedicated view
- Plugin can execute ALL CLI functions and display results

### 3. Storybook Integration (Reworked)

The previous approach (CLI-specific generators) is rejected. New approach:

- **Start from a Sitemap** — user creates/has a sitemap in the Flowti Plugin
- **Right-click action** — "Generate Component Library" from sitemap context menu
- **Automatic scaffolding** — creates a Storybook environment and all needed files derived from the sitemap
- **No project-specific config or generators needed** — good-looking baseline out of the box
- **Opt-in** — projects don't need to bring anything, just a sitemap
- **Framework templates provided by CLI:**
  - CLI App
  - HTML (Lit)
  - Vue
  - Angular
  - React
- Templates give each framework a ready-to-use Storybook-driven component library baseline

## Rationale

The experience must feel seamless when working inside the Flowti Plugin. The CLI does the heavy lifting; the Plugin makes it accessible and visual. No context switching to a terminal. No framework-specific setup scripts. Start with a sitemap, generate a component library, and go.
