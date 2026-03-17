---
type: Idea
stage: in-progress
origin: inbox
domain: developer-experience
description: "Restructure the repository so the plugin lives at the project root with proper meta-files for GitHub publishing and Obsidian marketplace submission."
tags:
  - release-blocker
  - RB-1
  - developer-experience
  - publishing
priority: "01 - critical"
planned_in: "[[Cycle 16 - Improvement Sprint]]"
parent: "[[Release Preparation PRD]]"
---

Currently the plugin sits in a sub-folder with all its meta-files, in order to let the plugin and the repo get correctly detected by various tools, the main plugin must live in the project root with all needed meta-files.

As long as this is not solved we are not able to use GitHub as publishing platform.

The refactoring and restructuring should be done as last step before release as currently the framework is to immature and core concepts like plugin-management are not refined enough, yet. 

We will remain with status quo under the `Development/` folder for the plugins.
Goal of this item is, to have Flowti fully managed and developed in its own installed structure.

The core question remains: How can we structure the Repository to follow the best practices and provide the needed files for discoverability on GitHub while staying with the Flowti Framework Constraints?

## Problem

The plugin source lives in `Development/flowti/` — a sub-folder of the documentation vault. GitHub and the Obsidian plugin marketplace expect `package.json`, `manifest.json`, `tsconfig.json`, etc. at the repository root. This prevents automated releases, CI/CD pipelines, and marketplace submission.

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
