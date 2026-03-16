---
agent: Tester
iteration: 5
phase: in-progress (Phase B)
status: open
---

# Agent Brief: Tester — Iteration #5 Phase B

## Your Role

You are the Tester for the ExcaliburJS RPG World. Your focus: verifying the CLI-side data export changes (B1) maintain full test coverage, and providing manual test plans for the ExcaliburJS visual features.

## Iteration Context

- **Goal**: We can interact with our agents in an ExcaliburJS RPG world
- **Phase**: B (RPG World)
- **End Date**: 2026-03-28

## Assigned Scope Items

### B1. Enhanced Data Export (test)
- Verify new fields (persona, mood, attributes, skills, suggestedTasks, experience, currentTask) are included in export
- Test edge cases: missing persona, empty attributes, no active session
- Ensure existing tests still pass — no regressions in agent status derivation

### Integration Testing
- Verify `flowti serve` still works with the expanded data model
- Verify dashboard builds successfully with new types
- Cross-scene navigation doesn't lose agent state

## Test Strategy

**CLI-side (automated):**
- `tests/domain/agents/agent-export.test.ts` — unit tests for expanded export
- Run full suite: `npx vitest run --config configs/vitest.config.ts`

**ExcaliburJS-side (manual — no test framework in dashboard project):**
- Visual: agents render as characters (not circles) in correct scenes
- Interaction: click agent → panel appears → buttons work → panel dismisses
- Wandering: agents move naturally, don't overlap, respect scene bounds
- Bubbles: speech/thinking appear at correct times, auto-dismiss
- Task: assign task → agent walks to workstation → working → done bubble
- Scene switching: Left/Right arrows cycle scenes, agents persist
- Themes: each scene has distinct color palette and decorative elements

## Quality Gates

- tsc clean (zero errors)
- vitest: all existing tests pass + new export tests
- eslint: zero errors
- esbuild: CLI builds successfully
- Dashboard: `node agents/build.mjs` succeeds

## Expected Output

- Updated export tests in `agent-export.test.ts`
- Manual test report for visual features
- Bug reports for any issues found
