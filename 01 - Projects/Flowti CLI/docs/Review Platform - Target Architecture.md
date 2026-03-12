---
type: Architecture
domain: review
title: Flowti Review Platform — Target Architecture & Capabilities
version: 1
created: 2026-03-12
status: draft
standards: ISO 9001, ISO 27001, ISO 25010, IREB
source: "[[Development Roadmap]]"
---

# Flowti Review Platform — Target Architecture & Capabilities

> A traceable verification system that connects requirements, automated tests, execution evidence, and release governance to ensure measurable software quality — all from within the Flowti CLI.

---

## 1. Vision

The Flowti CLI's **Review** command becomes a full **E2E Test Platform** — not just a test runner, but a quality assurance system. Every project managed by Flowti can declare what it needs tested, and the CLI brings the tools, collects evidence, traces back to requirements, and produces audit-ready reports.

**Core equation**: `Requirements + Journeys + Evidence = Auditable Quality`

The platform answers five auditor questions automatically:

1. **How are requirements verified?** → Journey steps link to requirement IDs via `traceability.requirements`
2. **How do releases meet requirements?** → Traceability reports show coverage gaps before release
3. **How do you prove test execution?** → Evidence artifacts (logs, screenshots, metrics) per run
4. **How do you ensure security?** → Security-tagged journeys with OWASP capability checks
5. **How do you detect regressions?** → Risk-scored journeys run on every change, gated by criticality

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLOWTI CLI — REVIEW                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Requirements │  │   Journey    │  │    Evidence Store     │ │
│  │    Store     │←→│   Engine     │─→│  logs / screenshots  │ │
│  │ REQ UC US    │  │              │  │  metrics / traces    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                 │                      │             │
│         │    ┌────────────┴────────────┐         │             │
│         │    │   Environment Registry  │         │             │
│         │    │  ┌─────┐ ┌──────────┐   │         │             │
│         │    │  │ CLI │ │ Obsidian │   │         │             │
│         │    │  │     │ │ Plugin   │   │         │             │
│         │    │  ├─────┤ ├──────────┤   │         │             │
│         │    │  │ TS  │ │ Webapp   │   │         │             │
│         │    │  ├─────┤ ├──────────┤   │         │             │
│         │    │  │Vault│ │ Custom   │   │         │             │
│         │    │  └─────┘ └──────────┘   │         │             │
│         │    └─────────────────────────┘         │             │
│         │                                        │             │
│  ┌──────┴────────────────────────────────────────┴───────────┐ │
│  │                   Report Generators                       │ │
│  │  Traceability │ Evidence │ Quality │ Risk │ Audit │ CAPA  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Quality Gates                           │ │
│  │  Coverage Gate │ Security Gate │ Risk Gate │ Release Gate │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
  flowti.config.json                    docs/ (markdown artifacts)
  (project declares needs)              (audit-ready evidence)
```

---

## 3. Capability Model

### 3.1 Requirements Traceability (IREB + ISO 9001)

**Purpose**: Link every test to a requirement. Prove coverage. Detect gaps.

#### Traceability Chain

```
REQ-001 (Requirement)
    ↓ linkedUseCases
UC-003 (Use Case)
    ↓ linkedUserStories
US-007 (User Story)
    ↓ journey.traceability.requirements
Journey: "getting-started"
    ↓ step.traceability
Step: "verify-plugin-loads"
    ↓ step.acceptanceCriteria
AC: "Plugin appears in settings"
    ↓ execution
Evidence: screenshot + log + pass/fail
```

#### Journey Traceability Fields (new)

```json
{
  "journey": "Getting Started",
  "traceability": {
    "requirements": ["REQ-001", "REQ-002"],
    "useCases": ["UC-003"],
    "userStories": ["US-007", "US-008"],
    "risk": "high",
    "category": "functional-suitability"
  },
  "steps": [
    {
      "id": "verify-plugin-loads",
      "traceability": {
        "requirements": ["REQ-001"],
        "verifies": "AC-001"
      },
      "acceptanceCriteria": [
        { "id": "AC-001", "description": "Plugin appears in settings", "required": true }
      ]
    }
  ]
}
```

#### Report: Traceability Matrix

Generated as `docs/reports/traceability-matrix.md`:

| Requirement | Status | Journey | Step | Result | Evidence |
|------------|--------|---------|------|--------|----------|
| REQ-001 | verified | getting-started | verify-plugin-loads | PASS | screenshot-001.png |
| REQ-002 | untested | — | — | — | — |

#### Report: Coverage Gap

```
Requirements: 47 total
  Linked to journeys: 38 (80.8%)
  Verified (last run): 35 (74.5%)
  Untested: 9
  Failed: 3
```

---

### 3.2 Journey Engine (Test Design + Execution)

**Purpose**: Define, compose, and execute E2E tests as declarative journey blueprints.

#### Journey Composition (new)

Journeys can reference steps from other journeys:

```json
{
  "steps": [
    { "$ref": "prerequisites#check-vault" },
    { "$ref": "installer#verify-first-run" },
    {
      "id": "custom-step",
      "title": "Project-specific verification",
      "actions": [...]
    }
  ]
}
```

#### Step Execution Control (new)

```json
{
  "id": "verify-data-migration",
  "skip": false,
  "dev": true,
  "retry": { "maxAttempts": 3, "delayMs": 1000 },
  "condition": { "runIf": "{{env.CI}}" },
  "timeout": 30000
}
```

#### Test Types

| Type | Purpose | ISO Alignment |
|------|---------|---------------|
| `functional` | Feature verification | ISO 25010 Functional Suitability |
| `regression` | Change impact detection | ISO 9001 Corrective Action |
| `smoke` | Deployment sanity check | ISO 25010 Reliability |
| `security` | Authorization, injection, secrets | ISO 27001 |
| `performance` | Load, response time, throughput | ISO 25010 Performance Efficiency |
| `exploratory` | Manual/guided discovery | IREB Elicitation |
| `blueprint` | Reusable step library | — |
| `usability` | UI flow validation | ISO 25010 Usability |
| `compatibility` | Cross-environment verification | ISO 25010 Compatibility |
| `integration` | Contract and API testing | ISO 25010 Interoperability |

#### Risk-based Prioritization

Journeys declare risk level. The engine prioritizes execution:

```json
{
  "traceability": {
    "risk": "critical",
    "category": "security"
  }
}
```

Execution order: `critical` → `high` → `medium` → `low`. Quality gates can block release on critical/high failures.

---

### 3.3 Environment Provider System

**Purpose**: Projects declare what they need. The CLI resolves how to test it.

#### Provider Resolution Flow

```
flowti.config.json
  └─ e2e.target: "obsidian-plugin"

Journey: requires.target = "obsidian-plugin"
  └─ requires.capabilities = ["obsidian-cli", "plugin-deploy"]

CLI resolves:
  1. Find provider for "obsidian-plugin"
  2. Check capabilities (obsidian-cli binary? plugin built?)
  3. Merge base tools (9) + provider tools (30+)
  4. Run provider setup (vault scaffold, plugin enable)
  5. Execute journey steps with resolved tools
  6. Run provider teardown (vault cleanup)
```

#### Provider Registry (current + planned)

| Provider | Target | Tools | Capabilities |
|----------|--------|-------|--------------|
| **CLI** | `cli` | 9 base | command, filesystem |
| **TypeScript** | `typescript` | +2 | + tsc-check, lint |
| **Obsidian Vault** | `obsidian-vault` | +2 | + vault-note, vault-structure |
| **Obsidian Plugin** | `obsidian-plugin` | +30 | + obsidian-cli, plugin-deploy, plugin-state, DOM interaction, event tools |
| **Webapp** | `webapp` | +3 | + http-check, dev-server, bundle-check |
| **Custom** (planned) | `custom` | configurable | project-defined via config |

#### Obsidian Plugin Provider Expansion

The current provider has 3 tools. The target is 30+ tools matching the Plugin's `actionRunner.ts`:

**DOM Interaction**: click, eval, set-input, select, scroll-to, navigate, close-leaves, close-modals, ribbon
**Visual**: highlight, screenshot (real), spinner, theme, visual-inspection
**Vault Operations**: create-file, delete-file, open-file, copy-file, move-file, seed
**Plugin State**: emit, assert-event, query-trace, plugin-state, plugin-deploy
**UI Feedback**: notice, styled-notice, manual (interactive approval)
**Batch**: parallel-group (single eval call for multiple assertions)

All implemented as `obsidian-cli` subprocess wrappers — the CLI never needs Obsidian internals.

---

### 3.4 Evidence Collection (ISO 9001 + Audit)

**Purpose**: Every test run produces verifiable artifacts. An auditor can trace any result back to its source.

#### Evidence Directory Structure

```
docs/
  evidence/
    runs/
      2026-03-12T14-30-00/
        run-manifest.json          # Run metadata, config, environment
        traceability-snapshot.json  # Requirement coverage at time of run
        journeys/
          getting-started/
            result.json             # Step-by-step results
            step-001/
              screenshot-before.png
              screenshot-after.png
              log.txt
              assertions.json
            step-002/
              ...
          installer/
            ...
        summary.json                # Aggregate metrics
```

#### Run Manifest

```json
{
  "runId": "2026-03-12T14-30-00",
  "timestamp": "2026-03-12T14:30:00.000Z",
  "project": "flowti-ibde",
  "projectType": "obsidian-plugin",
  "environment": {
    "provider": "obsidian-plugin",
    "capabilities": ["obsidian-cli", "plugin-deploy"],
    "nodeVersion": "20.11.0",
    "platform": "win32"
  },
  "config": { "bail": 1, "timeout": 30000 },
  "trigger": "manual",
  "operator": "lum"
}
```

#### Evidence Types

| Type | Collected By | Storage |
|------|-------------|---------|
| Screenshots | `screenshot` tool | PNG per step |
| Logs | All tools | TXT per step |
| Assertions | `assert` tool | JSON per step |
| API traces | `http-check` tool | HAR format |
| Performance metrics | `command` tool (timing) | JSON in result |
| State snapshots | `plugin-state` tool | JSON diff |
| Error context | On failure | Stack + DOM snapshot |

---

### 3.5 Quality Metrics (ISO 25010)

**Purpose**: Measure software quality across all 8 ISO 25010 characteristics.

#### Quality Dashboard (generated report)

```
┌─────────────────────────────────────────────────────┐
│           Project Quality Dashboard                 │
│           flowti-ibde — 2026-03-12                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Functional Suitability    ████████████░░  85%      │
│  Reliability               ██████████████  100%     │
│  Usability                 ████████░░░░░░  60%      │
│  Performance Efficiency    ██████████████  100%     │
│  Security                  ██████████░░░░  75%      │
│  Compatibility             ░░░░░░░░░░░░░░  N/A     │
│  Maintainability           ████████████░░  85%      │
│  Portability               ░░░░░░░░░░░░░░  N/A     │
│                                                     │
│  Overall Quality Score: 84/100                      │
│  Requirement Coverage: 80.8%                        │
│  Critical Path Pass Rate: 100%                      │
│  Risk Score: LOW                                    │
│                                                     │
│  Gate Status: ✓ RELEASE ELIGIBLE                    │
└─────────────────────────────────────────────────────┘
```

#### ISO 25010 Mapping

| Characteristic | Measured By | Journey Types |
|---------------|-------------|---------------|
| Functional Suitability | Feature journeys + requirement coverage | `functional` |
| Reliability | Repeated run consistency, MTTR | `regression`, `smoke` |
| Usability | UI flow journeys, manual inspection steps | `usability`, `exploratory` |
| Performance Efficiency | Timing assertions, load profiles | `performance` |
| Security | Auth, injection, privilege journeys | `security` |
| Compatibility | Cross-env provider runs | `compatibility` |
| Maintainability | Code coverage + test coverage + complexity | Report generators |
| Portability | Multi-platform runs | `compatibility` |

---

### 3.6 Quality Gates (Release Governance)

**Purpose**: Automated pass/fail decisions before release.

#### Gate Configuration (in `flowti.config.json`)

```json
{
  "review": {
    "gates": {
      "coverage": {
        "requirementCoverage": 80,
        "journeyCoverage": 90,
        "statementCoverage": 80
      },
      "security": {
        "required": true,
        "maxCritical": 0,
        "maxHigh": 0
      },
      "risk": {
        "criticalMustPass": true,
        "highMustPass": true
      },
      "release": {
        "allGatesMustPass": true,
        "requireApproval": false
      }
    }
  }
}
```

#### Gate Evaluation Flow

```
Run Complete
    ↓
Coverage Gate: REQ coverage ≥ 80%? Statement coverage ≥ 80%?
    ↓
Security Gate: 0 critical findings? 0 high findings?
    ↓
Risk Gate: All critical journeys pass? All high journeys pass?
    ↓
Release Gate: All sub-gates pass?
    ↓
Result: PASS → Release eligible
        FAIL → Block release, generate CAPA items
```

#### Auto-CAPA on Gate Failure

When a quality gate fails, the platform automatically creates CAPA items:

```
Gate: security FAILED — 1 critical finding
  → CAPA-047: Security gate failure — XSS vulnerability in component editor
    Source: e2e-gate-failure
    Severity: critical
    Status: open
    LinkedJourney: security/xss-prevention
    LinkedRequirement: REQ-023
```

---

### 3.7 Report Generators

**Purpose**: Produce audit-ready documents from evidence.

#### Report Types

| Report | Output | Content |
|--------|--------|---------|
| **Traceability Matrix** | `docs/reports/traceability-matrix.md` | REQ → Journey → Step → Result mapping |
| **Evidence Summary** | `docs/reports/evidence-summary.md` | Per-run artifact inventory |
| **Quality Dashboard** | `docs/reports/quality-dashboard.md` | ISO 25010 scores + trends |
| **Risk Assessment** | `docs/reports/risk-assessment.md` | Risk-scored journey results |
| **Gate Report** | `docs/reports/gate-report.md` | Pass/fail per gate with evidence links |
| **Audit Report** | `docs/reports/audit-report.md` | Composite: traceability + evidence + gates + CAPA |
| **CAPA Status** | `docs/reports/capa-status.md` | Open CAPAs from gate failures |
| **Coverage Gap** | `docs/reports/coverage-gap.md` | Untested requirements + recommendations |
| **Run History** | `docs/reports/run-history.md` | Trend data across runs |

All reports are markdown files with YAML frontmatter — consumable by the existing report pipeline and audit generators.

---

### 3.8 Project Configuration

**Purpose**: Projects declare their E2E needs. Zero hardcoded assumptions.

#### Extended `ReviewConfig`

```typescript
interface ReviewConfig {
  // Existing
  journeysDir?: string;
  testVault?: string;
  pluginId?: string;
  runner?: string;
  build?: string;
  test?: string;
  teardown?: string;
  rebuild?: string;

  // New — Environment
  target?: ProjectTarget;
  capabilities?: string[];

  // New — Execution
  sequencer?: "alphabetical" | "risk-priority" | "chapter-order";
  bail?: number;
  timeout?: number;
  hookTimeout?: number;
  parallel?: boolean;
  stepFilter?: string;

  // New — Evidence
  evidenceDir?: string;
  screenshots?: boolean;
  logs?: boolean;
  traces?: boolean;
  retainRuns?: number;

  // New — Quality Gates
  gates?: {
    coverage?: { requirementCoverage?: number; journeyCoverage?: number; statementCoverage?: number };
    security?: { required?: boolean; maxCritical?: number; maxHigh?: number };
    risk?: { criticalMustPass?: boolean; highMustPass?: boolean };
    release?: { allGatesMustPass?: boolean; requireApproval?: boolean };
  };
}
```

#### Minimal Config (zero-config start)

```json
{
  "review": {}
}
```

Defaults: `journeysDir: "tests/e2e/journeys"`, `target: "cli"`, `sequencer: "chapter-order"`, `bail: 0`, `timeout: 30000`, `screenshots: true`, `logs: true`.

#### Full Config (Obsidian Plugin)

```json
{
  "review": {
    "target": "obsidian-plugin",
    "journeysDir": "tests/e2e/journeys",
    "testVault": "../flowti-e2e",
    "pluginId": "flowti-ibde",
    "sequencer": "risk-priority",
    "bail": 1,
    "timeout": 30000,
    "screenshots": true,
    "evidenceDir": "docs/evidence",
    "gates": {
      "coverage": { "requirementCoverage": 80 },
      "security": { "required": true, "maxCritical": 0 },
      "risk": { "criticalMustPass": true }
    }
  }
}
```

---

## 4. Data Flow

### 4.1 Execution Flow

```
User: flowti review → E2E
                │
                ▼
        Load flowti.config.json
        Resolve ReviewConfig
                │
                ▼
        Discover .journey files
        Sort by sequencer (risk/chapter/alpha)
                │
                ▼
        For each journey:
          1. Validate traceability links (REQ/UC/US exist?)
          2. Resolve environment provider
          3. Check capabilities
          4. Run provider.setup()
          5. For each step:
             a. Check skip/condition
             b. Resolve tools (base + provider)
             c. Execute actions
             d. Collect evidence (log, screenshot, timing)
             e. Record result (pass/fail/skip)
             f. On failure: retry if configured, else continue/bail
          6. Run provider.teardown()
                │
                ▼
        Aggregate results
        Evaluate quality gates
        Generate reports
        Create CAPAs for gate failures
                │
                ▼
        Output: pass/fail + evidence + reports
```

### 4.2 Artifact Flow

```
.journey files          → Journey Engine      → step results
docs/requirements/      → Traceability Engine → coverage data
evidence/runs/          → Evidence Store      → artifact inventory
                               ↓
                        Report Generators
                               ↓
                   docs/reports/*.md (audit-ready)
```

---

## 5. CLI Command Surface

### Review Commands (extended)

| Command | Purpose |
|---------|---------|
| `review:e2e` | Run all journeys (non-interactive) |
| `review:e2e --journey=name` | Run specific journey |
| `review:e2e --type=security` | Run journeys by type |
| `review:e2e --risk=critical,high` | Run by risk level |
| `review:e2e --dry-run` | Show what would run without executing |
| `review:gates` | Evaluate quality gates against last run |
| `review:traceability` | Generate traceability matrix |
| `review:evidence` | List/inspect evidence from runs |
| `review:evidence --run=latest` | Show evidence from last run |
| `review:audit` | Generate full audit report |
| `review:coverage` | Show requirement → journey coverage |
| `review:changes` | Analyze git changes → suggest journeys (existing) |
| `review:all` | Build → Test → E2E → Gates → Reports |

### Interactive Menu (extended)

```
Review — flowti-ibde
─────────────────────────────────
Pipeline: ✓ Build  ✓ Test  ○ E2E

  [1] Build              [a] Run all (build→test→e2e→gates)
  [2] Test               [g] Quality gates
  [3] Run E2E journeys   [t] Traceability matrix
  [j] Run specific...    [c] Coverage report
  [s] Run by type...     [r] Audit report
  [n] New journey        [e] Evidence browser
  [l] List journeys      [v] Test vault
  [b] Back               [q] Quit
```

---

## 6. Implementation Roadmap

### Phase 8.5.1 — Journey Composition & Types (4h)
- Add `StepOrRef`, `JourneyRefStep` to `journey-types.ts`
- Add `traceability` field to `JourneyDefinition` and `JourneyStep`
- Add `skip`, `dev`, `retry`, `condition`, `timeout` to `JourneyStep`
- Add journey type: `security`, `performance`, `usability`, `compatibility`, `integration`
- Implement ref resolution with circular detection in `journey-loader.ts`
- Tests for all type additions and ref resolution

### Phase 8.5.2 — Executor Enrichment (6h)
- Step filtering via `stepFilter` config
- Dev-mode execution (early termination)
- Retry logic per step
- Conditional execution (`runIf`/`skipIf`)
- Step timeout enforcement
- Risk-priority sequencing
- Tests for all execution modes

### Phase 8.5.3 — Traceability Engine (6h)
- Validate journey traceability links against requirements store
- Build traceability matrix from journeys + requirements
- Coverage calculator: requirements → journeys → results
- Gap detector: untested/failed requirements
- Traceability report generator
- Tests

### Phase 8.5.4 — Evidence Collection (4h)
- Evidence directory management (create, retain, cleanup)
- Run manifest generation
- Per-step evidence collection (log, screenshot, assertions)
- Evidence index/inventory
- Evidence report generator
- Tests

### Phase 8.5.5 — Quality Gates (4h)
- Gate evaluation engine (coverage, security, risk, release)
- Gate configuration in `ReviewConfig`
- Gate report generator
- Auto-CAPA creation on gate failure
- Tests

### Phase 8.5.6 — Obsidian Provider Expansion (8h)
- Expand from 3 → 30+ tools via `obsidian-cli` subprocess
- DOM interaction tools (click, eval, navigate, etc.)
- Visual tools (screenshot, highlight)
- Vault operation tools (create/delete/open file, seed)
- Event tools (emit, assert-event, query-trace)
- Interactive tools (manual, visual-inspection)
- Batch tools (parallel-group)
- Tests with mock ToolDeps

### Phase 8.5.7 — Config & Commands (3h)
- Extend `ReviewConfig` with new fields
- Config validation for new fields
- New controller actions: `review:gates`, `review:traceability`, `review:evidence`, `review:audit`, `review:coverage`
- Menu extensions
- Tests

### Phase 8.5.8 — Report Generators (4h)
- Traceability Matrix report
- Quality Dashboard report (ISO 25010 scores)
- Gate Report
- Audit Report (composite)
- Coverage Gap report
- Run History report
- Tests

### Phase 8.5.9 — Plugin Thin-Client (6h)
- Plugin `.journey` files become the sole test definition
- Plugin `flowti.config.json` declares `review.target: "obsidian-plugin"`
- Remove Plugin's `tests/e2e/helpers/` infrastructure
- Plugin test files become thin wrappers calling CLI's journey runner
- Verify all Plugin journeys run through CLI

**Total: ~45h across 9 phases**

---

## 7. Standards Compliance Matrix

| Standard | Requirement | Platform Capability |
|----------|------------|-------------------|
| **ISO 9001** 8.2.3 | Design & development inputs documented | Requirements store + traceability links |
| **ISO 9001** 8.2.4 | Design outputs verified | Journey execution + evidence |
| **ISO 9001** 8.5.2 | Corrective action | Auto-CAPA on gate failure |
| **ISO 9001** 8.6 | Release of products | Quality gates + release gate |
| **ISO 9001** 9.1.1 | Monitoring, measurement, analysis | Quality dashboard + run history |
| **ISO 27001** A.14.2.8 | System security testing | Security journey type + security gate |
| **ISO 27001** A.12.1.4 | Separation of environments | Test vault isolation + provider setup |
| **ISO 25010** all | 8 quality characteristics | Journey types map to characteristics |
| **IREB** 3.4 | Requirements validation | Traceability matrix + coverage gap |
| **IREB** 4.2 | Requirements traceability | REQ → Journey → Step → Evidence chain |

---

## 8. Key Design Decisions

### 8.1 Everything is Markdown

All artifacts are markdown files with YAML frontmatter in the project's `docs/` directory. This means:
- Git-versioned (auditable change history)
- Human-readable (no proprietary formats)
- Machine-parseable (frontmatter + structured content)
- Consumable by existing report generators
- Viewable in Obsidian (the Plugin's natural habitat)

### 8.2 Projects Declare, CLI Resolves

The project says "I'm an Obsidian plugin that needs these capabilities tested." The CLI says "I have a provider for that, here are the tools." This inversion of control means:
- New project types get E2E support by adding a provider
- Existing journeys work across provider versions
- The Plugin never needs to know how testing infrastructure works

### 8.3 Progressive Opt-In

A project with zero E2E config still gets: base tools, chapter-order execution, evidence collection. Adding `review.target` unlocks provider tools. Adding `review.gates` unlocks quality gating. Adding `traceability` to journeys unlocks requirement coverage. No big-bang adoption required.

### 8.4 Evidence Over Trust

Every assertion produces evidence. Every run produces a manifest. Every failure links to artifacts. The platform assumes it will be audited and collects evidence proactively, not retroactively.
