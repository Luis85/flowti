---
type: ProjectStatusReport
project: flowti-cli
date: "2026-03-07T18:44:51.359Z"
tests_passed: 51
tests_failed: 0
tests_skipped: 0
tests_total: 51
tests_suites: 3
tests_duration_ms: 1215
tests_success: true
coverage_statements_pct: 2.16
coverage_branches_pct: 1.81
coverage_functions_pct: 4.55
coverage_files_covered: 54
codebase_schema_version: 2.0
codebase_modules: 55
codebase_classes: 1
codebase_interfaces: 17
codebase_functions: 90
codebase_type_aliases: 6
codebase_methods: 21
codebase_properties: 63
codebase_constructors: 1
complexity_total_files: 110
complexity_total_functions: 1364
complexity_above_threshold: 102
complexity_threshold: 10
complexity_max_complexity: 145
complexity_avg_complexity: 3.8
---

# Project Status Report

Generated: 2026-03-07 18:44:51

## Tests

> [!info] Summary
> Total: 51 | Passed: 51 | Failed: 0 | Skipped: 0
> Suites: 3 | Duration: 1215ms
> Result: PASS

## Suites

| Suite | Tests | Passed | Status |
|---|---:|---:|---|
| tests/infrastructure/args.test.ts | 9 | 9 | PASS |
| tests/infrastructure/document.test.ts | 25 | 25 | PASS |
| tests/domain/make/naming.test.ts | 17 | 17 | PASS |

---

## Coverage

> [!info] Summary
> Statements: 2.16% | Branches: 1.81% | Functions: 4.55%
> Files: 54

## Files

| File | Stmts % | Branch % | Fn % |
|---|---:|---:|---:|
| `src/main.ts` | 0 | 0 | 0 |
| `src/mainMenu.ts` | 0 | 0 | 0 |
| `src/types.ts` | 0 | 0 | 0 |
| `src/domain/build/build.ts` | 0 | 0 | 0 |
| `src/domain/capture/capture.ts` | 0 | 0 | 0 |
| `src/domain/devtools/cli-reload.ts` | 0 | 0 | 0 |
| `src/domain/devtools/devtools.ts` | 0 | 0 | 0 |
| `src/domain/devtools/fix-frontmatter.ts` | 0 | 0 | 0 |
| `src/domain/devtools/generate-test-data.ts` | 0 | 0 | 0 |
| `src/domain/help/help.ts` | 0 | 0 | 0 |
| `src/domain/info/info.ts` | 0 | 0 | 0 |
| `src/domain/knowledgebase/knowledgebase.ts` | 0 | 0 | 0 |
| `src/domain/knowledgebase/vault-service.ts` | 0 | 0 | 0 |
| `src/domain/make/appTemplates.ts` | 0 | 0 | 0 |
| `src/domain/make/make.ts` | 0 | 0 | 0 |
| `src/domain/make/templates.ts` | 0 | 0 | 0 |
| `src/domain/onboarding/onboarding.ts` | 0 | 0 | 0 |
| `src/domain/project/project-config.ts` | 0 | 0 | 0 |
| `src/domain/project/project.ts` | 0 | 0 | 0 |
| `src/domain/publish/project-publish.ts` | 0 | 0 | 0 |
| `src/domain/publish/publish.ts` | 0 | 0 | 0 |
| `src/domain/reports/reports.ts` | 0 | 0 | 0 |
| `src/domain/reports/cli/generate-codebase-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/cli/generate-complexity-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/cli/generate-coverage-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/cli/generate-status-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/cli/generate-test-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/build-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/cli-reference.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/codebase-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/command-reference.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/complexity-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/coverage-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/cycle-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/data-dictionary.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/e2e-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/event-catalog.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/performance-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/test-report.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/tool-reference.ts` | 0 | 0 | 0 |
| `src/domain/reports/generators/trace-report.ts` | 0 | 0 | 0 |
| `src/domain/review/project-review.ts` | 0 | 0 | 0 |
| `src/domain/review/review.ts` | 0 | 0 | 0 |
| `src/domain/review/run-e2e.ts` | 0 | 0 | 0 |
| `src/infrastructure/fs.ts` | 0 | 0 | 0 |
| `src/infrastructure/menu.ts` | 0 | 0 | 0 |
| `src/infrastructure/readline.ts` | 0 | 0 | 0 |
| `src/infrastructure/shell.ts` | 0 | 0 | 0 |
| `src/infrastructure/state.ts` | 0 | 0 | 0 |
| `src/infrastructure/ui.ts` | 0 | 0 | 0 |
| `src/domain/make/naming.ts` | 62.5 | 0 | 80 |
| `src/infrastructure/config.ts` | 86.36 | 43.48 | 50 |
| `src/infrastructure/document.ts` | 88.17 | 85.71 | 83.33 |
| `src/infrastructure/args.ts` | 100 | 100 | 100 |

---

## Codebase

> [!info] Summary
> Modules: 55 | Classes: 1 | Interfaces: 17
> Functions: 90 | Type Aliases: 6
> Methods: 21 | Properties: 63

## Modules by Domain

| Domain | Modules |
|---|---:|
| domain | 42 |
| infrastructure | 9 |
| main | 1 |
| mainMenu | 1 |
| types | 1 |
| vendor | 1 |

---

## Complexity

> [!info] Summary
> Files: 110 | Functions: 1364 | Above threshold (>10): 102
> Max: 145 | Avg: 3.8

## Top Complex Functions

| # | Complexity | File | Line |
|---:|---:|---|---:|
| 1 | 145 | `bin/src/domain/reports/generators/e2e-report.js` | 1468 |
| 2 | 145 | `src/domain/reports/generators/e2e-report.ts` | 1831 |
| 3 | 101 | `bin/src/domain/reports/generators/e2e-report.js` | 814 |
| 4 | 101 | `src/domain/reports/generators/e2e-report.ts` | 1101 |
| 5 | 77 | `bin/src/domain/review/run-e2e.js` | 1214 |
| 6 | 77 | `src/domain/review/run-e2e.ts` | 1381 |
| 7 | 62 | `bin/src/domain/review/run-e2e.js` | 620 |
| 8 | 62 | `src/domain/review/run-e2e.ts` | 741 |
| 9 | 59 | `bin/src/domain/review/run-e2e.js` | 867 |
| 10 | 59 | `src/domain/review/run-e2e.ts` | 1007 |
| 11 | 58 | `bin/src/domain/reports/generators/e2e-report.js` | 517 |
| 12 | 58 | `src/domain/reports/generators/e2e-report.ts` | 768 |
| 13 | 43 | `bin/src/domain/reports/generators/e2e-report.js` | 755 |
| 14 | 43 | `src/domain/reports/generators/e2e-report.ts` | 1043 |
| 15 | 42 | `bin/src/domain/reports/generators/e2e-report.js` | 1301 |

---
