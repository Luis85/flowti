---
type: TechnicalDebt
severity: medium
status: open
domain: journey-builder
created: 2026-03-05
identified_in: C55
source: Cycle 55 DoD review
tags:
  - architecture
  - journey-builder
  - ui
---

# TD-130: JourneyBuilderSidebar exceeds orchestrator size convention

## Description

`JourneyBuilderSidebar.ts` is 1,026 LOC — exceeding the 500-800 LOC orchestrator convention (see TD-01). The sidebar handles 3 states (welcome/setup/steps), rendering orchestration, canvas sync scheduling, event suggest wiring, template/tool picker state management, and import/export coordination.

## Impact

- Medium — the file is functional and well-tested (141 integration tests) but harder to navigate and reason about as a single unit.

## Root Cause

Organic growth across 12 increments (C55). Each increment added state and rendering logic that accumulated in the orchestrator.

## Suggested Resolution

Extract rendering methods into dedicated render helpers:
- `renderWelcome()` → `WelcomeScreen.ts` (~80 LOC)
- `renderSetup()` → `SetupForm.ts` (~120 LOC)
- Canvas sync scheduling → `CanvasSyncController.ts` (~60 LOC)

Target: sidebar orchestrator < 600 LOC, focused on state management and coordination only.

## Related

- TD-01: UI files exceed size convention
- TD-128: DashboardsTab exceeds orchestrator size convention (resolved C49)
- [[Cycle 55 - Journey Builder]]
