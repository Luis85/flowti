---
type: Increment
feature: "[[Hubs PRD]]"
pbi: ""
phase: 1
increment: 1
stage: done
date: 2026-02-15
tasm_score: 29
tasm_review: "[[Three Amigos Review 2026-02-15]]"
tests_added: 0
tests_total: 1662
test_suites: 77
loc_added: 278
---

# Phase 1: Foundation (TD-50)

## Context

The Event Catalog and Data Exchange Hub were isolated views with duplicated shell logic (tab bar, content area, lifecycle management). TD-50 required a shared workspace shell.

## Scope

Extracted `BaseHubView` abstract class (278 LOC) from two existing System Hubs. ~220 LOC of duplicated shell logic unified. 3 hub lifecycle events registered in catalog.

## Changes

### New Files

- `src/ui/BaseHubView.ts` — Abstract class (278 LOC) providing shared hub shell: top bar, tab bar, dashboard/split toggle, search, lifecycle events, render scheduling, event subscription cleanup

### Modified Files

- Event catalog data — 3 new hub lifecycle events: `hub.opened`, `hub.closed`, `hub.tab.changed`

## Events

| Event | Payload | Direction |
|-------|---------|-----------|
| `hub.opened` | `{ hubId, hubType }` | State |
| `hub.closed` | `{ hubId }` | State |
| `hub.tab.changed` | `{ hubId, tabId, previousTabId }` | State |

## Decisions

- TD-49 (Layout Registry), TD-51 (Component Registry), TD-52 (Declarative Tab Definitions), TD-53 (UI Primitives) deferred as unnecessary for the inheritance-based approach

## Verification

1. 1,662 tests pass across 77 suites
2. `npm run build` passes
