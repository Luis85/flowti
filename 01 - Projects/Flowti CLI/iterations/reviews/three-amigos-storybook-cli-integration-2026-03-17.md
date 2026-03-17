---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Storybook CLI Integration — version-agnostic scaffold + non-interactive commands"
date: 2026-03-17
aligned: true
---

# Three Amigos Review — Storybook CLI Integration

## Scope Item

Version-agnostic Storybook scaffold (replace pinned versions with `"latest"`) and five non-interactive CLI commands (`storybook:install`, `storybook:start`, `storybook:stop`, `storybook:build`, `storybook:generate`). Plus supporting fixes: `startStorybookDev()` non-interactive service function, post-init config patching for Storybook 10, `npm install` before `storybook init`, `--type` flag for framework detection, missing `node_modules` detection.

## Product Owner Perspective

- **Value**: Makes the component design system accessible from any terminal/CI context. Ensures new installations always get the latest Storybook instead of being pinned to 8.x.
- **Acceptance Criteria**:
  - [x] AC1: Given a fresh project, when I run `flowti storybook:install`, then Storybook is installed with the latest version and the correct framework
  - [x] AC2: Given Storybook is installed, when I run `flowti storybook:generate`, then stories are generated from `configs/sitemap.json` for all pages
  - [x] AC3: Given stories are generated, when I run `flowti storybook:start`, then Storybook opens in the browser showing the sitemap pages
  - [x] AC4: Given Storybook is running, when I run `flowti storybook:stop`, then the process is killed
  - [x] AC5: Given Storybook is installed, when I run `flowti storybook:build`, then a static site is produced
  - [x] AC6: Given `node_modules` is missing, when I run `storybook:start`, then a helpful error message is shown instead of a raw shell error
  - [ ] AC7: Given existing TUI component files exist, when I run `storybook:install`, then those files are preserved (not clobbered)

## Software Architect Perspective

- **Technical Approach**: `adaptDescriptor` controller pattern, domain service with dependency injection, `StorybookRenderer` interface for progress output, post-init patching for Storybook config
- **Risks**:
  - Storybook init is destructive — overwrites `.storybook/main.ts` (root cause of AC7)
  - `"latest"` version specifier not deterministic (mitigated by lock file)
  - Framework detection may break on future Storybook major versions
- **Fix for AC7**: Skip `storybook init` when `.storybook/main.ts` already exists — just run `npm install` to update packages
- **Task Breakdown**:
  - [ ] Add guard in `installStorybook()`: if `.storybook/main.ts` exists, skip init and only run `npm install`

## Tester Perspective

- **Test Scenarios**:
  - [x] Fresh install flow (install → generate → start → stop)
  - [x] Install with `--framework` flag
  - [ ] Reinstall preserves existing TUI files
  - [x] Missing `node_modules` shows helpful error
  - [x] Not installed shows "not installed" message
  - [x] Already running shows "already running"
  - [x] Stop when not running shows "not running"
  - [x] Generate runs cleanly on repeat
- **Edge Cases**: Mid-install failure, missing config section, Windows path spaces, `--framework=vue` → `--type vue3` mapping
- **Test Approach**: 57 unit tests (controller + domain service), manual smoke test for full flow, no integration test (acceptable)

## Alignment

- Status: Aligned
- One open item: AC7 (install clobbers existing files) — agreed approach is to skip `storybook init` when already configured
