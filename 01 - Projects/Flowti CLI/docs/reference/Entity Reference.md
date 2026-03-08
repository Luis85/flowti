---
type: EntityReference
date: "2026-03-08T21:35:11.109Z"
total_entities: 9
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
| [[#Flowti Project\|Flowti Project]] | `project`, `scaffold:new`, `scaffold:list`, `info` | Report, Component, Event Catalog, Component Library |
| [[#Journey\|Journey]] | `make:journey`, `e2e`, `e2e:list` | Test, Test Suite, Report |
| [[#Component\|Component]] | `make:component`, `components` | Component Library, Flowti Project |
| [[#Component Library\|Component Library]] | `components` | Component, Flowti Project |
| [[#Test\|Test]] | `build (runs tests as prerequisite)` | Test Suite, Report, Journey |
| [[#Test Suite\|Test Suite]] | — | Test, Report |
| [[#Event\|Event]] | `events:add`, `events:list`, `events:export` | Event Catalog, Flowti Project |
| [[#Event Catalog\|Event Catalog]] | `events:list`, `events:export` | Event, Flowti Project |
| [[#Report\|Report]] | `report:test`, `report:coverage`, `report:codebase`, `report:complexity`, `report:status`, `report:summary`, `reports` | Test, Test Suite, Flowti Project |

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
