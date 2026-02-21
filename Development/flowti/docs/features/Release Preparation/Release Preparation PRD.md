---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: planned
maturity: L1
maturity_score_strategy: 5
maturity_score_scope: 4
maturity_score_architecture: 2
maturity_score_event_integration: 1
maturity_score_data_model: 1
maturity_score_ui_consistency: 1
maturity_score_validation_testing: 1
business_value: 5
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 5
fri_score: 15
tags:
  - release-blocker
  - publishing
  - developer-experience
  - core
---

# Feature: Release Preparation

> Inbox sources: [[We need to have the proper file and folder structure in place before publishing]], [[We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace]]

---

## 1. Vision & Strategic Context

> Before Flowti can be published on the Obsidian Community Plugin Marketplace, the repository structure and code quality must meet Obsidian's developer policies and GitHub's publishing requirements.

**Strategic position**: This is a prerequisite for all go-to-market activity. Without these changes, the plugin cannot be submitted to the Obsidian marketplace, CI/CD cannot be configured, and community contributions are blocked.

---

## 2. Problem Statement

- **Repository structure**: The plugin source lives in `Development/flowti/` — a subfolder. GitHub, npm, and the Obsidian marketplace expect meta-files (`package.json`, `manifest.json`, etc.) at the repository root. This blocks automated releases and marketplace submission.
- **Obsidian ESLint compliance**: The Obsidian developer policies require specific code patterns and disallow certain APIs (e.g., unsanitized `innerHTML`). Without these rules enforced, the plugin review will fail.
- **No CI/CD pipeline**: No GitHub Actions workflow for automated build, test, and release.
- **No versioning strategy**: No semantic versioning workflow connected to the build pipeline.

---

## 3. Outcome (Success Definition)

- `package.json` and `manifest.json` at repository root
- `npm install && npm run build` works from repository root
- GitHub Actions can build, test, and release the plugin
- All Obsidian developer policy ESLint rules pass
- Plugin submission to Obsidian community marketplace succeeds

---

## 4. Scope

### In Scope

- Repository restructure: move meta-files to root
- Obsidian ESLint rules configuration and codebase compliance
- GitHub Actions CI/CD workflow (build, test, release)
- Semantic versioning via `version-bump.mjs`
- Release artifact generation (`main.js`, `manifest.json`, `styles.css`)

### Out of Scope

- BRAT (Beta Reviewer Auto-update Tester) integration
- Obsidian marketplace review negotiation
- Marketing / announcement
- Plugin documentation website

---

## 5. Functional Requirements

### Repository Restructure (RB-1)

- [ ] Move `package.json`, `manifest.json`, `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs` to repository root
- [ ] Move `src/` to repository root
- [ ] Move `tests/` to repository root
- [ ] Update all import paths and build configuration
- [ ] Keep documentation in `docs/` at root
- [ ] Ensure `npm install && npm run build` works from root
- [ ] All existing tests pass from new structure

### Obsidian ESLint Compliance (RB-2)

- [ ] Add Obsidian-specific ESLint rules per Developer Policies
- [ ] Fix all violations across the codebase
- [ ] Integrate Obsidian ESLint rules into `npm run check` pipeline
- [ ] No forbidden API usage (unsanitized `innerHTML`, deprecated APIs)

### CI/CD Pipeline

- [ ] GitHub Actions workflow: install → lint → type-check → test → build
- [ ] Release workflow: version bump → build → create GitHub release with artifacts
- [ ] Branch protection: require CI pass before merge

### Versioning

- [ ] Semantic versioning enforced via `version-bump.mjs`
- [ ] `manifest.json` version updated automatically on release
- [ ] `versions.json` updated for Obsidian compatibility tracking

---

## 6. Acceptance Criteria

- [ ] `package.json` at repository root
- [ ] `npm install && npm run build` works from repository root
- [ ] All existing tests pass from new structure
- [ ] Obsidian ESLint rules configured and passing
- [ ] GitHub Actions CI workflow passes on push
- [ ] Release workflow creates GitHub release with artifacts
- [ ] Plugin structure meets Obsidian community plugin requirements

---

## Product Backlog Items

| PBI | Title | Status | Priority |
|-----|-------|--------|----------|
| [[PBI-RP-001 Repository Restructure]] | Move plugin to repository root | PLANNED | Critical (RB-1) |
| [[PBI-RP-002 Obsidian ESLint Compliance]] | Implement Obsidian ESLint rules | PLANNED | Critical (RB-2) |
| [[PBI-RP-003 CI-CD Pipeline]] | GitHub Actions build and release | PLANNED | High |

---

## Related

- Inbox: [[We need to have the proper file and folder structure in place before publishing]], [[We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace]]
- PRDs: [[Developer Experience PRD]]
