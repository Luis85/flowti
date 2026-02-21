---
type: idea
stage: planned
origin: inbox
domain: developer-experience
description: "Restructure the repository so the plugin lives at the project root with proper meta-files for GitHub publishing and Obsidian marketplace submission."
tags:
  - release-blocker
  - RB-1
  - developer-experience
  - publishing
priority: "01 - critical"
planned_in: "[[Release Preparation Cycle]]"
parent: "[[Release Preparation PRD]]"
---

Currently the plugin sits in a subfolder with all its meta-files, in order to let the plugin and the repo get correctly detected by various tools, the main plugin must live in the project root with all needed meta-files.

As long as this is not solved we are not able to use GitHub as publishing platform.

## Problem

The plugin source lives in `Development/flowti/` — a subfolder of the documentation vault. GitHub and the Obsidian plugin marketplace expect `package.json`, `manifest.json`, `tsconfig.json`, etc. at the repository root. This prevents automated releases, CI/CD pipelines, and marketplace submission.

## Proposed Solution

1. Move plugin meta-files (`package.json`, `manifest.json`, `tsconfig.json`, `esbuild.config.mjs`, etc.) to repository root
2. Keep source code in `src/` at root level
3. Keep documentation in `docs/` or a dedicated documentation folder
4. Update all build scripts and CI/CD configuration
5. Ensure Obsidian can still load the plugin from the vault's `.obsidian/plugins/` directory

## Acceptance Criteria

- [ ] `package.json` and `manifest.json` at repository root
- [ ] `npm install && npm run build` works from repository root
- [ ] GitHub Actions can build and release the plugin
- [ ] Obsidian community plugin submission requirements met
- [ ] All existing tests pass from new structure
