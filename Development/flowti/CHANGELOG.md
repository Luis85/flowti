# Changelog

All notable changes to the Flowti IBDE plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 33 Architecture Decision Records (ADR-001 through ADR-024 + related)
- UI Command Bus — all user entry points route through `ui.*` events
- DocService centralization — all doc creation via `doc.create` events
- BaseEntityTab&lt;T&gt; deduplication — 438 LOC reduction across 4 entity tabs
- Products tab — file-driven product documentation with cross-references
- Data Exchange Hub — CSV import/export with config persistence
- Event Definition domain — source event → domain event transforms
- Subscription domain — file-pattern-based event watchers
- Ingestion domain — batched file processing with retry and catch-up
- Installer wizard — 4-page modal with step pipeline
- Event Catalog — ~190 events with search, filtering, and per-event config
- Component Showcase view — living style guide for ft-* classes
- Session Workspaces — time-boxed documentation sessions with 9 types, activity tracking, goals, decisions, templates
- User Hub — personal cockpit with dashboard, inbox, sessions, preferences
- Nudge Service — time-based session start prompts with midnight rollover
- Inbox Service — unified inbox with subscription, import, and export mappers
- Hub Registry — cross-hub summary aggregation with provider pattern
- Session handler extraction (TD-101) — SessionService reduced from 1,766 → 613 LOC
- Session render debouncing (TD-100) — 16ms render debounce + batched panel refreshes
- Activity Intelligence (PBI-SW-015) — display-time activity log filtering
- CHANGELOG.md — release tracking established

### Changed
- Error handling: silent `catch {}` replaced with `console.warn`
- Storage: TypedStorage&lt;T&gt; with mutex-protected saves
- Testing: 111 test files, 2,855 tests passing (32 skipped)
- Flow integration tests: 15 suites covering all documented user journeys
- EventConfigModal decomposed into 3 page components
- contentGenerator.ts split into 3 focused modules
- Modal business logic extraction (ADR-023): csvUtils → `utils/`, PipelinePreview → `PipelineExecutor.buildPreview()`
- catalog/helpers.ts decomposed into barrel + 5 focused modules
- Tech debt register: 122 items (TD-01 through TD-120 + 2), ~50 resolved, ~5 mitigated, ~65 open
- Source codebase: 230 files, ~44,346 LOC across 15 bounded contexts with 14 registered services
- Development cycles: 11 cycles (Cycles 1-11), 9 delivered

### Fixed
- Dual-state bug: SettingsService.load() in onLayoutReady
- Storage race condition: PathMutex on saveStateToStorage
- Render-time writes: normalizeDocFrontmatter now read-only during scan
- Activity log display-time filtering (Cycle 9 pre-cycle hotfix)
- Session title disambiguation in User Hub sessions list
- Closure review auto-open on session.closure.started
