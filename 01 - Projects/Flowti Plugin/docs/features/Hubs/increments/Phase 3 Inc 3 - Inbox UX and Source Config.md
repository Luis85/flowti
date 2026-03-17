---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-001 User Hub]]"
phase: 3
increment: 3
stage: done
date: 2026-02-16
tasm_score: 0
tasm_review: "[[Three Amigos Review - Inbox UX and Source Config 2026-02-16]]"
tests_added: 0
tests_total: 1764
test_suites: 78
loc_added: 0
---

# Phase 3, Increment 3: Inbox UX & Source Config

## Context

Activity tab was redundant with standalone EventLogView sidebar. Inbox needed UX refinement and source configuration.

## Scope

Removed Activity tab. Restyled dashboard inbox as always-visible mail-inbox section (after quick actions, accent borders for unread, source badges, max 5 with "View all" link). Added inbox source configuration (`inboxEnabledSources` setting with 4 per-source toggles). Deep-linking: inbox to catalog via `onNavigateToEntity`. Title bar hidden on all hubs.

## Changes

### Modified Files

- `src/ui/UserHubView.ts` — Removed Activity tab, added source config wiring
- `src/ui/userHub/UserHubDashboard.ts` — Restyled inbox section, deep-linking
- `src/ui/userHub/UserHubInbox.ts` — Active row highlighting, triggered-by deep-linking
- `src/domain/inbox/InboxService.ts` — `setEnabledSources()` gates item creation
- `src/ui/BaseHubView.ts` — Title bar hidden on all hubs
- Settings-related files updated with `inboxEnabledSources`

## Verification

1. 1,764 tests pass across 78 suites
2. `npm run build` passes
3. Dashboard inbox shows max 5 items with "View all"
4. Source toggles gate inbox item creation
