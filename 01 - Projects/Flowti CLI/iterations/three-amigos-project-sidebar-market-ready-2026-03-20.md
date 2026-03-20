---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Project Sidebar — Market-Ready Polish + Import from Git"
date: 2026-03-20
aligned: true
---

# Three Amigos Review — Project Sidebar Market-Ready

## Scope Item

Project Sidebar — Market-Ready Polish + Import from Git. All work delivered in session 2026-03-19/20: canvas presets (11 total), git import (template/submodule/empty), ProjectBrief as DocService type, storybook addon fixes, output filtering, UI polish, Ask Bob auto-scroll + debug actions.

## Product Owner Perspective

- **Value**: Project sidebar is now the complete onboarding surface. New users can create projects, import from Git, generate sitemap canvases from presets, scaffold Storybook components, and manage the full lifecycle — all from the sidebar.
- **Acceptance Criteria**:
	- [x] "+" dropdown shows Import from Git, New from Template, Create Empty
	- [x] Create Empty creates config + brief (DocService) + sketchpad canvas, opens detail view
	- [x] Git import clones with core.longpaths=true, streams progress, wizard detects framework
	- [x] Canvas presets generate, auto-open, and highlight active selection
	- [x] Save imports canvas into sitemap.json and hides preset buttons
	- [x] Storybook installs with addon-vitest + addon-a11y registered in config
	- [x] Ask Bob chat auto-scrolls on new messages
	- [x] Debug tab has Expand, Copy, Resend actions
- **Priority**: High — primary user-facing onboarding flow

## Software Architect Perspective

- **Technical Approach**: Plugin Lit components dispatch custom events → project-handlers orchestrates → vault-project-service spawns CLI commands. Canvas export is pure domain. ProjectBrief flows through DocService event pipeline.
- **Risks**: All mitigated — vault cache lag (disk fallback), double-quoting (shellQuote fix), numeric identifiers (toPascal fix)
- **Tech Debt (flagged for follow-up)**:
	- [ ] Extract canvas presets to separate files (canvas-sitemap-export.ts ~950 lines)
	- [ ] Derive preset list from shared source (currently defined in UI + CLI separately)
	- [ ] Replace disk fallback with proper Obsidian vault adapter notification for new files
- **Task Breakdown**: 11 tasks, all delivered

## Tester Perspective

- **Test Scenarios**:
	- [x] Create empty project → config + brief + sketchpad created
	- [x] Import template → clone, .git removed, detect, bootstrap
	- [ ] Import submodule → needs git repo context to verify
	- [ ] Canvas preset generation → unit tests for each preset (flagged)
	- [ ] Hierarchical sitemap → groups → unit test (flagged)
	- [x] toPascal numeric prefix → passes (naming.test.ts)
	- [ ] Storybook addon regex → unit test for JSON-style keys (flagged)
	- [ ] shellQuote edge cases → unit test (flagged)
	- [x] DocService ProjectBrief → passes (DocService.test.ts)
	- [x] Ask Bob auto-scroll → manually verified
- **Edge Cases**: Special chars in project names, duplicate project creation, submodule on non-git vault, preset override when sitemap exists
- **Test Approach**: Existing suites (493 CLI tests, 12 handler tests) + manual verification. 4 unit test gaps flagged for follow-up iteration.

## Alignment

- Status: Aligned
- All three perspectives confirmed. Tech debt and test gaps documented for follow-up — no blockers on the delivered work.
