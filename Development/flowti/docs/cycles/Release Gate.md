---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: deferred
cycle:
release_anchor:
  - "Theme 1: Ship It — Release Path"
pbis:
  - "TD-92: Lightweight PR process"
  - "TD-78: Domain documentation completion"
  - "TD-81: User story content completion"
  - "PBI-REL-001: Release preparation checklist"
  - "PBI-REL-002: Final manual QA pass"
bugs: []
tech_debt:
  - TD-92
  - TD-78
  - TD-81
estimated_increments: 6
---

# Release Gate

## Release Anchor Theme

- **Theme 1: Ship It — Release Path** — The final quality gate before marketplace submission.

## Cycle Overview

After six cycles of investment — release readiness (C49), user activation (C50), dogfooding (C51), architecture (C52), data exchange (C53), and feature deepening (C54) — this cycle ensures everything is polished, documented, and process-ready for the Obsidian community plugin marketplace.

No new features. Only documentation, process, quality assurance, and the final release checklist.

## User Pains (Pre-Release Gaps)

1. **No PR process** — No peer review, no branch protection, no CI gating. Acceptable for solo development but risky as the codebase becomes public (TD-92).
2. **11 domain documents are empty stubs** — Business Operations, Supplier Management, and 9 others have no content. Domain boundaries are undefined for contributors (TD-78).
3. **5 user stories are title-only** — No acceptance criteria, no actors, no business value. Development lifecycle feedback loop broken (TD-81).
4. **No formal release checklist** — Each release is ad-hoc. No repeatable verification process.
5. **No final QA pass** — Individual increments are tested but no end-to-end manual walkthrough of the complete user experience.

## Cycle Goals

1. **Establish lightweight PR process** with branch protection and CI
2. **Complete all domain documentation** (11 empty stubs → full content)
3. **Complete all user story content** (5 stubs → acceptance criteria, actors, value)
4. **Create and execute release preparation checklist**
5. **Perform final manual QA pass** across all features

## Scope

### In Scope
- TD-92: PR process (GitHub Actions CI, branch protection rules, conventional commits)
- TD-78: Domain documentation (11 empty docs → content with boundaries, services, events, ownership)
- TD-81: User story completion (5 stories → full INVEST format)
- PBI-REL-001: Release preparation checklist (repeatable verification process)
- PBI-REL-002: Final manual QA pass (end-to-end walkthrough, screenshot documentation)
- RB-6 final decision: ship CLI installer or formally defer to v1.1

### Out of Scope
- New features (feature freeze)
- Architecture changes
- Performance optimization
- Signal v2 / AI / Mobile

## Increments

### Inc 1: GitHub Actions CI Pipeline (TD-92a)
**Theme**: Ship It
**Effort**: Medium

Set up automated CI pipeline:
- GitHub Actions workflow: `ci.yml`
- Triggers: push to main, pull request to main
- Steps: checkout → install → `npm run check` (lint + tsc) → `npm test` (vitest)
- Status badge in README.md
- Branch protection: require CI pass before merge

**Acceptance Criteria**:
- [ ] `.github/workflows/ci.yml` created and operational
- [ ] CI runs on push and PR
- [ ] lint, tsc, and vitest all execute in CI
- [ ] Status badge added to README.md
- [ ] Branch protection enabled on main branch
- [ ] CI passes on current codebase
- [ ] `npm test` green locally

### Inc 2: PR Process and Conventional Commits (TD-92b)
**Theme**: Ship It
**Effort**: Small

Establish lightweight contribution process:
- `CONTRIBUTING.md` with PR guidelines
- Conventional commit format: `type(scope): description` (feat, fix, refactor, docs, test, chore)
- PR template (`.github/pull_request_template.md`)
- Minimum: 1 reviewer (self for solo, external for contributors)
- Merge strategy: squash merge to main

**Acceptance Criteria**:
- [ ] CONTRIBUTING.md created with clear guidelines
- [ ] PR template created
- [ ] Conventional commit format documented
- [ ] Merge strategy documented
- [ ] Example PR created to validate workflow

### Inc 3: Domain Documentation Completion (TD-78)
**Theme**: Ship It
**Effort**: Large

Complete all 11 empty domain documentation stubs:
- For each domain: purpose, bounded context, services, events, entities, dependencies, ownership
- Domains to document: settings, user, installer, discovery, eventFilter, eventNotify, subscription, ingestion, capture, nudge, onboarding
- Use existing mature domain docs (analytics, session, train) as templates
- Cross-reference with Event Catalog and Data Dictionary

**Acceptance Criteria**:
- [ ] All 11 domain docs have meaningful content
- [ ] Each doc covers: purpose, context boundary, services, events, entities, dependencies
- [ ] Cross-references to Event Catalog and Data Dictionary
- [ ] Consistent format across all domain docs
- [ ] TD-78 resolved

### Inc 4: User Story Completion (TD-81)
**Theme**: Ship It
**Effort**: Medium

Complete all 5 user story stubs with full INVEST format:
- Actor (persona reference)
- Goal and business value
- Acceptance criteria (Given/When/Then)
- Dependencies and related stories
- Priority and effort estimate

**Acceptance Criteria**:
- [ ] All 5 user stories have complete content
- [ ] Each story follows INVEST criteria
- [ ] Acceptance criteria in Given/When/Then format
- [ ] Persona references linked to persona docs
- [ ] TD-81 resolved

### Inc 5: Release Preparation Checklist (PBI-REL-001)
**Theme**: Ship It
**Effort**: Medium

Create and execute a repeatable release checklist:
- **Code Quality**: `npm test` green, `npm run check` clean, no skipped tests
- **Build**: `npm run build` produces valid `main.js`, `manifest.json`, `styles.css`
- **Documentation**: README accurate, CHANGELOG current, all domain docs complete
- **Security**: No secrets in code, SecretStore for sensitive data, ESLint Obsidian rules pass
- **Marketplace**: manifest.json valid, version bumped, description and keywords set
- **Assets**: Icon, banner, screenshots prepared
- **Process**: CONTRIBUTING.md in place, CI green, branch protection active
- **Verification**: Fresh vault install test, upgrade from previous version test

**Acceptance Criteria**:
- [ ] Release checklist document created in `docs/`
- [ ] All checklist items verified and passing
- [ ] Fresh install tested on clean vault
- [ ] Manifest.json validated against Obsidian plugin requirements
- [ ] Screenshots captured for marketplace listing

### Inc 6: Final Manual QA Pass (PBI-REL-002)
**Theme**: Ship It
**Effort**: Medium

End-to-end manual walkthrough of the complete user experience:
- **Installer**: Run installer wizard on fresh vault → verify folders, seed content, user creation
- **User Hub**: Open User Hub → verify dashboard, idea capture, onboarding callouts
- **Event Catalog**: Browse events → verify completeness, system event filtering
- **Data Exchange**: Import CSV → verify import, export, pipeline (including multi-source if C53 delivered)
- **Analytics**: Create query → build dashboard → verify tiles, filtering, pagination
- **Train**: Start train → capture thoughts → merge branches → verify canvas
- **Session**: Start session → track activity → close → verify note generation
- **Signal**: Configure Azure DevOps → sync → verify work items (if test instance available)
- **Settings**: Toggle all settings → verify persistence across restart
- **Commands**: Open Command Catalog → verify all commands listed and executable

**Acceptance Criteria**:
- [ ] All 10 feature areas manually verified
- [ ] No blocking bugs discovered (or bugs fixed inline)
- [ ] QA results documented in `docs/reports/qa/`
- [ ] Screenshots captured for key workflows
- [ ] `npm test` green after any inline fixes

## Dependency Graph

```
Inc 1 (CI Pipeline)    ──→ Inc 2 (PR Process) ──→ Inc 5 (Release Checklist)
Inc 3 (Domain Docs)    ──→ Independent
Inc 4 (User Stories)   ──→ Independent
Inc 5 (Checklist)      ──→ Inc 6 (Final QA)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Domain docs require deep domain knowledge for 11 domains | Medium | Use codebase as source of truth; document what exists, not aspirations |
| CI pipeline setup may require GitHub secrets configuration | Low | Only test/lint/build — no deployment secrets needed |
| Manual QA discovers blocking bugs | High | Budget 1 extra increment for bug fixes; defer non-critical issues |
| Branch protection disrupts solo workflow | Low | Allow admin override; protection is for external contributions |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~20 (bug fixes only, no new features) |
| Post-cycle tests | ~5,905 |
| Domain docs completed | 11 (from 0 content) |
| User stories completed | 5 (from 0 content) |
| CI pipeline | Operational and green |
| Release checklist items | All passing |
| Tech debt resolved | TD-92, TD-78, TD-81 |
| Increments | 6 |
| **Release readiness** | **Marketplace submission ready** |

## Post-Cycle 55: What's Next

After Cycle 55, the plugin is ready for marketplace submission. The roadmap beyond C55 shifts from "build" to "listen":

1. **v1.0 Marketplace Submission** — Submit to Obsidian community plugin registry
2. **Community Feedback Cycle** — First cycle driven entirely by user feedback
3. **Signal v2** — Jira + GitHub adapters (once ADO is proven in production)
4. **AI Foundation** — LLM integration (once platform is stable with real users)
5. **Bases Integration** — Obsidian 1.10 Bases views (once Bases API stabilizes)

The five Release Anchor Themes served their purpose: guiding 7 cycles of focused investment from stabilization through release. Future themes will emerge from real-world usage data.
