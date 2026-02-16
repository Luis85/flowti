---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: idea
related_events: []
maturity: L0
business_value: 4
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 3
design_cost: 3
test_cost: 3
priority: 2
---

# Feature: Test Management

---

## 1. Problem Statement

Teams documenting systems in Obsidian have no structured way to manage test plans, test cases, and test execution results alongside their domain documentation. Test artifacts live in external tools (Jira, TestRail, spreadsheets), disconnected from the requirements and flows they validate.

- **Who is affected?** QA engineers, developers, and product managers who need visibility into test coverage and results.
- **What breaks?** Test status is invisible in the knowledge vault, making it hard to assess feature readiness or find untested requirements.
- **Why it matters:** Embedding test management in the vault creates a single source of truth where requirements, flows, tests, and results live together.

---

## 2. Outcome

- **User can** create test cases as structured vault notes, link them to requirements and flows, execute test runs, and track pass/fail results.
- **System can** aggregate test results, compute coverage metrics, and surface untested requirements via the health dashboard.
- **Domain gains** a test management layer that connects verification to specification within the same vault.

---

## 3. Scope

### In Scope (vision)

- Test case doc type (`TestCaseDoc`) with structured frontmatter
- Test suite grouping (by feature, flow, or custom grouping)
- Manual test execution: mark steps as pass/fail with notes
- Test run tracking: date, executor, results summary
- Coverage view: test cases vs. requirements/flows
- Integration with Vault Health Dashboard for test coverage metrics

### Out of Scope

- Automated test execution (e.g., running vitest from within Obsidian)
- CI/CD integration
- Screenshot or video capture
- Defect/bug tracking (separate concern)
- Load/performance testing

---

## 4. UX Entry Points

- **Event Catalog / Hub**: Test Cases tab showing master-detail list
- **Command palette**: `flowti:new-test-case`, `flowti:new-test-run`
- **Requirements detail panel**: "Linked Test Cases" section
- **Flow detail panel**: "Verification" section showing linked tests

---

## 5. Functional Requirements

- [ ] TestCaseDoc frontmatter: `type`, `status`, `priority`, `linkedRequirements`, `linkedFlows`, `steps`
- [ ] Test case master list with filters (status, priority, suite)
- [ ] Detail panel showing test steps, expected results, and execution history
- [ ] Test run creation: select test cases, execute, record pass/fail per step
- [ ] Test run summary: total, passed, failed, blocked, not run
- [ ] Coverage view: requirements/flows vs. linked test cases
- [ ] Status indicators on linked entities (requirement has passing tests, etc.)

---

## 6. Data Model Impact

Potential entities:

```
TestCaseDoc (frontmatter)
  type: "TestCaseDoc"
  name: string
  suite?: string
  priority: "critical" | "high" | "medium" | "low"
  status: "draft" | "ready" | "deprecated"
  linkedRequirements: string[]
  linkedFlows: string[]
  steps: TestStep[]

TestStep
  order: number
  action: string
  expectedResult: string

TestRunDoc (frontmatter)
  type: "TestRunDoc"
  name: string
  date: string
  executor: string
  testCases: TestRunResult[]

TestRunResult
  testCaseRef: string
  result: "pass" | "fail" | "blocked" | "skipped"
  notes?: string
```

Stored as markdown files in `docsRootPath/Tests/` and `docsRootPath/TestRuns/`.

---

## 7. Event Impact

### Produced (proposed)

- `test.case.created` — payload: `{ name, filePath }`
- `test.run.started` — payload: `{ runName, testCaseCount }`
- `test.run.completed` — payload: `{ runName, passed, failed, blocked }`
- `test.case.deleted` — payload: `{ name, filePath }`

### Consumed

- `file.created` / `file.modified` / `file.deleted` — to detect test doc changes
- `requirement.created` / `requirement.deleted` — to update coverage links

---

## 8. UI Layout Impact

- New "Tests" tab in Event Catalog or dedicated Hub
- Split-dock layout: test case master list + detail panel
- Test run modal: step-by-step execution wizard
- Coverage matrix sub-tab

---

## 9. Adapter Impact

```
TestManagementService (proposed)
├── scanTestCases(): TestCaseEntry[]
├── createTestCase(name, suite?): Promise<TFile>
├── deleteTestCase(filePath): Promise<void>
├── createTestRun(name, testCaseRefs): Promise<TFile>
├── recordResult(runPath, testCaseRef, result): Promise<void>
├── getCoverageMatrix(): CoverageRow[]
└── getRunHistory(): TestRunSummary[]
```

---

## 10. Non-Functional Requirements

- **Scalability**: Handle 1000+ test cases with virtualized lists
- **Traceability**: Bidirectional links between test cases and requirements/flows
- **History**: Test runs are append-only — past results never overwritten

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Test management scope creep towards full QA tool | Keep scope to documentation-grade testing; not a TestRail replacement |
| Large test suites making frontmatter unwieldy | Steps stored in note body, not frontmatter; frontmatter holds metadata only |
| Stale test links after requirement changes | Health check detects broken test-to-requirement references |

---

## 12. Acceptance Criteria

- [ ] User can create a TestCaseDoc with steps, priority, and requirement links
- [ ] Test case master list supports filtering by suite and status
- [ ] User can create and execute a test run, marking each case as pass/fail
- [ ] Test run summary shows aggregate results
- [ ] Coverage view shows requirements with/without linked test cases
- [ ] Linked test status visible on requirement detail panels

---

## 13. Definition of Done

- [ ] TestCaseDoc and TestRunDoc schemas defined
- [ ] TestManagementService with scan, CRUD, and execution methods
- [ ] Tests tab implemented with master-detail layout
- [ ] Test run execution wizard implemented
- [ ] Coverage matrix view implemented
- [ ] Unit tests cover service and scan logic
- [ ] `npm run build` passes
