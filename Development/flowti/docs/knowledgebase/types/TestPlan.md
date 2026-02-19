---
type: DocumentType
name: TestPlan
abbreviation: ""
folder: ""
icon: flask-conical
---

# TestPlan

A **TestPlan** is the comprehensive test strategy and plan for the project. It defines why, how, and what is tested — from unit tests through flow integration tests to planned E2E tests.

The project has a single TestPlan document: [[Testplan and Teststrategy]].

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"TestPlan"` | yes | Document type discriminator |
| `stage` | enum | yes | `draft` · `done` |
| `domain` | string | yes | Test domain (e.g., `Flowti/Tests`) |
| `plugin` | wikilink | no | Link to plugin README |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Test Strategy (Goals, Test Pyramid, Frameworks & Tools, Methodologies, Isolation, What We Don't Test)
2. Roadmap (E2E Testing, Quality Reporting, Expanded Coverage Targets)
3. Test Plan (Generated Reports, Current Metrics, Use Case Index)
4. Architecture (source tree diagram)
5. Features (per-feature: source files, test files, use cases)
6. Coverage Strategy (Tier Model, 100% Coverage Files, Coverage Gaps)
7. Appendices (Build Pipeline, Test Environment, Test File Index)

## Test Pyramid

```
        E2E (planned)       ~0 tests
        Flow Integration    ~87 tests (28 skipped)
        Integration         ~45 tests
        Unit                ~1,300+ tests
```

## Quality Instruments

The TestPlan is one of four quality instruments in the [[Idea to Solution Workflow]]:

| Instrument | When Applied | What It Measures |
|-----------|-------------|-----------------|
| FRI | Pre-implementation | Design completeness (0-35) |
| Technical Review | Pre-implementation | Architecture soundness |
| **TestPlan** | **During implementation** | **Code correctness (build gate)** |
| TASM | Post-implementation | Implementation quality (0-35) |

## Build Pipeline Gate

```
npm run build = vitest → typedoc → tsc → eslint → esbuild
```

Every `npm run build` runs the full test suite. A failing test blocks the entire pipeline.
