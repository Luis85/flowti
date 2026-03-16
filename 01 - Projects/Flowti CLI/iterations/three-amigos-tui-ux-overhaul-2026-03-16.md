---
type: ThreeAmigosReview
iteration: 5
scopeItem: "TUI UX Overhaul — VS Code-style focus zones, section memory, chat integration"
date: 2026-03-16
aligned: true
---

# Three Amigos Review — TUI UX Overhaul

## Scope Item

Fix TUI navigation with VS Code-style focus zones (Tab switches between activity bar and content, arrow keys navigate within zones), section memory, zone-aware status hints, inline chat integration, adaptive terminal sizing, and single build file.

**Branch:** `feat/iter-5/tui-ux-overhaul`
**Spec:** `docs/specs/2026-03-16-tui-ux-overhaul-design.md`
**Plan:** `docs/plans/2026-03-16-tui-ux-overhaul.md`
**Implementation:** 5 commits, 28 files, 1,264 lines added, 403 test files / 7,152 tests green

## Product Owner Perspective

- **Value**: The TUI is the primary interaction surface for Flowti CLI. Broken navigation, fixed sizing, placeholder chat, and 3-file builds all block real adoption. This overhaul makes it production-quality.

- **Acceptance Criteria**:
  - [ ] AC1: Project selection works — user can open Project section, see a list, select one, reach detail page
  - [ ] AC2: Focus zone cycling — Tab cycles activity-bar ↔ content with visual indicator (cyan border/cursor)
  - [ ] AC3: Section navigation — ↑↓ + Enter opens sections; section memory preserves page stacks across switches
  - [ ] AC4: Escape feels natural — goes back in content; at root moves to activity bar; does NOT steal from pages
  - [ ] AC5: Zone-aware hints — status bar shows context-appropriate key hints per focus zone
  - [ ] AC6: Adaptive terminal sizing — layout adapts to window dimensions; no overflow/breakage at 80x24 through fullscreen
  - [ ] AC7: Chat fully integrated — chat page wired to ChatShell for real agent conversations, not just rendered components
  - [ ] AC8: Single build file — all bundles merged into one ESM output

## Software Architect Perspective

- **Technical Approach**: Iterative polish on the existing 6-chunk implementation. Fix bugs found in review, then add missing capabilities.

- **Issues Found**:
  1. **Critical: Can't select project** — No `projects-list-page`; project section lands directly on `project-detail`. Loader ignores `params.project`.
  2. **High: App steals Escape** — Global `useInput` in App intercepts all Escape, blocks page-level handling (forms, dialogs).
  3. **High: Chat not wired** — `useChatSession` manages state but `submitRef`/`commandRef` never connected to ChatShell.
  4. **Medium: Fixed sidebar width** — ActivityBar hardcoded `width={14}`, breaks on narrow terminals (<50 cols).
  5. **Medium: No vertical scroll** — MessageArea and DashboardPage overflow on small terminals.
  6. **Medium: `enabled` prop incomplete** — Not all pages accept/use it; keyboard not fully gated.
  7. **Medium: 3 bundles remain** — `main.js`, `tui.mjs`, `chat.mjs` still separate.

- **Task Breakdown** (iterative priority order):
  1. Fix project selection (projects-list-page + loader params)
  2. Fix Escape handling (guard App's handler)
  3. Adaptive sizing (useStdout for sidebar, scroll for message/dashboard)
  4. Wire ChatShell to useChatSession
  5. Single ESM build

## Tester Perspective

- **Test Scenarios**:
  - [ ] TS1: Small terminal (80x24, 40x12) — no layout overflow
  - [ ] TS2: Large terminal (200x60) — content fills space
  - [ ] TS3: Project selection flow — Project section → list → select → detail → Escape back
  - [ ] TS4: Escape in form — form page Escape cancels form, not captured by App
  - [ ] TS5: Chat input end-to-end — navigate to chat → type → reaches ChatShell
  - [ ] TS6: Section memory — navigate deep in 3 sections → cycle → each resumes

- **Edge Cases**:
  - Terminal resize while running (SIGWINCH)
  - Agent with no persona in chat page
  - Chat messages exceeding terminal width
  - Rapid Tab during transitions
  - Empty project list (no managed projects)

- **Test Approach**: Unit tests for each fix (TDD), integration tests for full navigation flows, manual verification for sizing/layout

## Alignment

- Status: Aligned — iterate on remaining gaps during active iteration
- Decision: Work iteratively on fixes in priority order (project selection → escape → sizing → chat wiring → single build) to find and fix issues before production
- No items deferred — all 8 AC remain in scope for iteration #5
