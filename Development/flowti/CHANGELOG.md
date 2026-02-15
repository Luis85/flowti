# Changelog

All notable changes to the Flowti IBDE plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 22 Architecture Decision Records (ADR-001 through ADR-022)
- UI Command Bus — all user entry points route through `ui.*` events
- DocService centralization — all doc creation via `doc.create` events
- BaseEntityTab&lt;T&gt; deduplication — 438 LOC reduction across 4 entity tabs
- Products tab — file-driven product documentation with cross-references
- Data Exchange Hub — CSV import/export with config persistence
- Event Definition domain — source event → domain event transforms
- Subscription domain — file-pattern-based event watchers
- Ingestion domain — batched file processing with retry and catch-up
- Installer wizard — 4-page modal with step pipeline
- Event Catalog — 136 events with search, filtering, and per-event config
- Component Showcase view — living style guide for ft-* classes
- CHANGELOG.md — release tracking established

### Changed
- Error handling: silent `catch {}` replaced with `console.warn`
- Storage: TypedStorage&lt;T&gt; with mutex-protected saves
- Testing: 65 test files, 1,447 tests (32 skipped)
- Flow integration tests: 10 suites covering all documented user journeys (87 pass, 28 skip)
- EventConfigModal decomposed into 3 page components
- contentGenerator.ts split into 3 focused modules
- Tech debt: 27 of 41 items resolved, 4 mitigated, 0 high-severity open

### Fixed
- Dual-state bug: SettingsService.load() in onLayoutReady
- Storage race condition: PathMutex on saveStateToStorage
- Render-time writes: normalizeDocFrontmatter now read-only during scan
