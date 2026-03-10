---
type: EntityReference
date: "2026-03-10T14:59:57.170Z"
total_entities: 14
tags:
  - reference
  - entities
  - architecture
---

# Entity Reference

The entity dictionary of the Flowti CLI ecosystem. Each entry describes what the entity is, why it exists, where it lives in the codebase, and how it relates to other entities.

## Summary

| Entity | Commands | Related To |
|---|---|---|
| [[#Flowti Project\|Flowti Project]] | `project`, `scaffold:new`, `scaffold:list`, `info` | Report, Component, Event Catalog, Component Library, Health Snapshot, Scaffold Definition |
| [[#Journey\|Journey]] | `make:journey`, `e2e`, `e2e:list` | Test, Test Suite, Report |
| [[#Component\|Component]] | `make:component`, `components` | Component Library, Flowti Project |
| [[#Component Library\|Component Library]] | `components` | Component, Flowti Project |
| [[#Test\|Test]] | `build (runs tests as prerequisite)` | Test Suite, Report, Journey |
| [[#Test Suite\|Test Suite]] | — | Test, Report |
| [[#Event\|Event]] | `events:add`, `events:list`, `events:export` | Event Catalog, Flowti Project |
| [[#Event Catalog\|Event Catalog]] | `events:list`, `events:export` | Event, Flowti Project |
| [[#Report\|Report]] | `report:test`, `report:coverage`, `report:codebase`, `report:complexity`, `report:status`, `report:summary`, `reports` | Test, Test Suite, Flowti Project |
| [[#Build Manifest\|Build Manifest]] | `build:check`, `build:auto`, `build:record` | Flowti Project, Report |
| [[#Plugin Hooks\|Plugin Hooks]] | — | Flowti Project |
| [[#Scaffold Definition\|Scaffold Definition]] | `scaffold:new`, `scaffold:list`, `marketplace:import` | Flowti Project, Export Bundle |
| [[#Export Bundle\|Export Bundle]] | `marketplace:export` | Scaffold Definition, Flowti Project |
| [[#Health Snapshot\|Health Snapshot]] | `health` | Report, Flowti Project |

## Flowti Project

A named project folder managed by the Flowti CLI. Each project has its own config, reports, and tool bindings.

### Purpose

Unit of organization. All CLI commands operate within a project context. Projects live under the vault's project directory.

### Where

- src/domain/project/project.ts — project listing, selection, creation
- src/domain/project/project-config.ts — config loading, validation, initialization
- src/infrastructure/state.ts — persisted project selection

### Configuration

Config keys: `name (required), tools, make, reports, docs, publish, review`

### Commands

- `flowti project`
- `flowti scaffold:new`
- `flowti scaffold:list`
- `flowti info`

### Artifacts

- `configs/flowti.config.json`
- `package.json`

### Related Entities

- [[#Report|Report]]
- [[#Component|Component]]
- [[#Event Catalog|Event Catalog]]
- [[#Component Library|Component Library]]
- [[#Health Snapshot|Health Snapshot]]
- [[#Scaffold Definition|Scaffold Definition]]

---

## Journey

An end-to-end test scenario defined as a JSON configuration file. Journeys describe multi-step user flows with assertions.

### Purpose

E2E test authoring and execution. Journeys define the steps, tools, and assertions for testing complete user workflows.

### Where

- src/domain/e2e/ — E2E service, runner, interactive session
- src/domain/make/makers.ts — makeJourney scaffolding
- tests/e2e/journeys/ — journey definition files (.journey)

### Configuration

Config keys: `review.journeysDir`

### Commands

- `flowti make:journey`
- `flowti e2e`
- `flowti e2e:list`

### Artifacts

- `{journeysDir}/{slug}.journey`
- `tests/e2e/{number}-journey-{slug}.test.ts`

### Related Entities

- [[#Test|Test]]
- [[#Test Suite|Test Suite]]
- [[#Report|Report]]

---

## Component

A building block of the project — UI component, layout, page, or C4 architecture entity — with documentation, a test file, and a JSON definition.

### Purpose

Structured project decomposition. Components are discovered, scaffolded, browsed, and tested through the CLI.

### Where

- src/domain/make/component/ — registry, scaffolding, listing
- src/domain/make/component/definitions/ — 8 bundled JSON definitions
- docs/components/ — per-component markdown documentation

### Configuration

Config keys: `make.templates`

### Commands

- `flowti make:component`
- `flowti components`

### Artifacts

- `docs/components/{name}.md`
- `src/components/{name}/{name}.json`
- `tests/components/{name}.test.ts`

### Related Entities

- [[#Component Library|Component Library]]
- [[#Flowti Project|Flowti Project]]

---

## Component Library

The collection of all components in a project, discoverable via the component browser menu.

### Purpose

Catalog and navigation of project components. Provides an overview of all components with their kinds, statuses, and locations.

### Where

- src/domain/make/component/component-list.ts — discovery, browser menu
- src/domain/make/component/component-types.ts — ComponentKind, ComponentDefinition

### Commands

- `flowti components`

### Artifacts

- `docs/components/`

### Related Entities

- [[#Component|Component]]
- [[#Flowti Project|Flowti Project]]

---

## Test

A Vitest test file that verifies behavior. Tests can be unit tests (domain logic), integration tests (flows), or E2E journey tests.

### Purpose

Quality assurance. Tests are the primary verification mechanism — they gate builds and generate test reports.

### Where

- tests/ — all test files
- src/domain/reports/cli/generate-test-report.ts — test report generator

### Commands

- `flowti build (runs tests as prerequisite)`

### Artifacts

- `reports/tests/testreport.json`
- `reports/tests/{timestamp}-test-report.md`

### Related Entities

- [[#Test Suite|Test Suite]]
- [[#Report|Report]]
- [[#Journey|Journey]]

---

## Test Suite

A logical grouping of test files (e.g., all domain tests, all flow tests, all E2E journey tests).

### Purpose

Organizational unit for test execution. Suites are tracked in test reports with pass/fail/pending counts.

### Where

- tests/ — directory structure defines suites
- configs/vitest.config.ts — test include/exclude patterns

### Artifacts

- `reports/tests/testreport.json`

### Related Entities

- [[#Test|Test]]
- [[#Report|Report]]

---

## Event

A named occurrence in the system that can be produced and consumed. Events have domains, versions, and payload schemas.

### Purpose

Inter-domain communication. Events decouple producers from consumers and enable the event catalog reference document.

### Where

- src/domain/events/event-catalog.ts — add/list/export operations
- src/domain/events/event-store.ts — event persistence

### Configuration

Config keys: `events (implicit via event files)`

### Commands

- `flowti events:add`
- `flowti events:list`
- `flowti events:export`

### Artifacts

- `docs/events/{domain}/{event-name}.md`

### Related Entities

- [[#Event Catalog|Event Catalog]]
- [[#Flowti Project|Flowti Project]]

---

## Event Catalog

The collection of all event definitions for a project, browsable via the events menu.

### Purpose

Documentation and discoverability. The event catalog provides a queryable index of all events with their producers, consumers, and schemas.

### Where

- src/domain/events/event-catalog.ts — interactive menu, CLI commands

### Commands

- `flowti events:list`
- `flowti events:export`

### Artifacts

- `docs/events/`

### Related Entities

- [[#Event|Event]]
- [[#Flowti Project|Flowti Project]]

---

## Report

A generated markdown document with YAML frontmatter, stored in the reports directory. Reports are timestamped and archived.

### Purpose

Observability and tracking. Reports capture project health metrics (tests, coverage, complexity, build status) at a point in time.

### Where

- src/domain/reports/ — generators, registry, runner
- src/domain/reports/cli/ — individual report generators
- src/domain/reports/report-archive.ts — archive browser

### Configuration

Config keys: `reports.dir, reports.generators[]`

### Commands

- `flowti report:test`
- `flowti report:coverage`
- `flowti report:codebase`
- `flowti report:complexity`
- `flowti report:status`
- `flowti report:summary`
- `flowti reports`

### Artifacts

- `reports/{subdir}/{timestamp}-{slug}.md`
- `reports/{title}.md`

### Related Entities

- [[#Test|Test]]
- [[#Test Suite|Test Suite]]
- [[#Flowti Project|Flowti Project]]

---

## Build Manifest

A JSON record of the last successful build — source hash, timestamp, output files, and build duration.

### Purpose

Build freshness detection. The CLI compares source files against the manifest to determine if a rebuild is needed.

### Where

- src/domain/build/build-freshness.ts — freshness check, source diff

### Commands

- `flowti build:check`
- `flowti build:auto`
- `flowti build:record`

### Artifacts

- `.flowti/build-manifest.json`

### Related Entities

- [[#Flowti Project|Flowti Project]]
- [[#Report|Report]]

---

## Plugin Hooks

Lifecycle hooks declared by a project's flowti.config.json. Hooks run at specific points in the build/test/publish pipeline.

### Purpose

Extensibility. Hooks allow projects to inject custom logic (linting, formatting, validation) into the CLI pipeline without modifying CLI source.

### Where

- src/domain/plugins/plugin-hooks.ts — hook loading, validation, execution
- src/domain/plugins/plugin-loader.ts — hook extraction from config

### Configuration

Config keys: `hooks.prebuild, hooks.postbuild, hooks.pretest, hooks.posttest`

### Artifacts

- `flowti.config.json (hooks section)`

### Related Entities

- [[#Flowti Project|Flowti Project]]

---

## Scaffold Definition

A versioned template definition that describes how to scaffold a new project or component. Definitions can be bundled or imported from a remote registry.

### Purpose

Project creation and code generation. Scaffold definitions are the blueprints for new projects, with versioning and marketplace distribution.

### Where

- src/domain/scaffold/scaffold-schema.ts — definition schema, validation
- src/domain/scaffold/scaffold-version.ts — version comparison, diff
- src/domain/scaffold/remote-registry.ts — remote fetch, install
- src/domain/scaffold/marketplace.ts — marketplace listing, import

### Configuration

Config keys: `scaffold.definitions`

### Commands

- `flowti scaffold:new`
- `flowti scaffold:list`
- `flowti marketplace:import`

### Artifacts

- `.flowti/definitions/{id}.json`

### Related Entities

- [[#Flowti Project|Flowti Project]]
- [[#Export Bundle|Export Bundle]]

---

## Export Bundle

A JSON package containing scaffold definitions, AI tool definitions, and plugin metadata for sharing across vaults.

### Purpose

Marketplace distribution. Bundles package multiple definitions for import into other Flowti installations.

### Where

- src/domain/scaffold/marketplace-export.ts — bundle creation, save

### Commands

- `flowti marketplace:export`

### Artifacts

- `exports/flowti-bundle-{date}.json`

### Related Entities

- [[#Scaffold Definition|Scaffold Definition]]
- [[#Flowti Project|Flowti Project]]

---

## Health Snapshot

A point-in-time capture of project health metrics — test results, coverage, lint warnings, complexity scores, and tech debt items.

### Purpose

Health tracking and trend analysis. Snapshots are saved to enable historical comparison and quality gate enforcement.

### Where

- src/domain/health/health.ts — snapshot collection
- src/domain/health/health-scoring.ts — quality gate scoring
- src/domain/health/health-trends.ts — trend persistence, delta calculation
- src/domain/health/tech-debt.ts — debt estimation
- src/ui/health-display.ts — console rendering

### Commands

- `flowti health`

### Artifacts

- `.flowti/health-history.json`

### Related Entities

- [[#Report|Report]]
- [[#Flowti Project|Flowti Project]]

---
