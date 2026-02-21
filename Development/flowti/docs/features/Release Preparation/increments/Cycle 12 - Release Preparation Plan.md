---
type: Increment
feature: "[[Release Preparation PRD]]"
stage: planned
date: 2026-02-20
---

# Cycle 12 — Release Preparation Plan

## Context

Before Flowti can be published on the Obsidian Community Plugin Marketplace, several release-blocking items must be completed. This cycle plan organizes all release-blocker (RB-*) tagged items into a sequenced delivery plan.

## Release Blockers Inventory

| RB | PBI | Feature | Priority | Dependencies |
|----|-----|---------|----------|-------------|
| RB-1 | [[PBI-RP-001 Repository Restructure]] | Release Preparation | Critical | None |
| RB-2 | [[PBI-RP-002 Obsidian ESLint Compliance]] | Release Preparation | Critical | RB-1 |
| RB-3 | [[PBI-CAN-001 Canvas Parser and Importer]] | Canvas Integration | High | Data Exchange Hub ✅ |
| RB-4 | [[PBI-002 Seed Starter Content]] | Installer | High | Installer ✅ |
| RB-7 | [[PBI-006 Pipeline Multi-Source Merge]] | Data Exchange Hub | High | None |
| — | [[PBI-RP-003 CI-CD Pipeline]] | Release Preparation | High | RB-1 |
| — | [[PBI-QC-001 Quick Capture Ribbons]] | Quick Capture | High | None |

## Sequencing

### Phase A: Infrastructure (RB-1 + RB-2)

**Goal**: Repository structure and code quality meet Obsidian marketplace requirements.

**Increment A.1 — Repository Restructure (RB-1)**
- Move meta-files to repository root
- Update all import paths and build configuration
- Verify all tests pass from new structure
- Gate: `npm install && npm test && npm run build` from root

**Increment A.2 — Obsidian ESLint Compliance (RB-2)**
- Configure Obsidian ESLint rules
- Audit and fix all violations
- Integrate into build pipeline
- Gate: `npm run check` includes Obsidian rules, all pass

**Increment A.3 — CI/CD Pipeline**
- GitHub Actions CI workflow (build + test on push)
- Release workflow (version bump → build → release → artifacts)
- Gate: CI passes on push, release creates GitHub release

### Phase B: Feature Completeness (RB-3, RB-4, RB-7, Quick Capture)

**Goal**: Core features complete for first release.

**Increment B.1 — Canvas Parser & Importer (RB-3)**
- Migrate QuickAdd scripts to `src/domain/dataExchange/canvas/`
- Canvas import wizard, context menu, progress events
- Gate: Canvas import from Data Exchange Hub works end-to-end

**Increment B.2 — Seed Starter Content (RB-4)**
- `SeedContentStep` in installer pipeline
- Example domain, session templates, welcome note
- Gate: First-run shows populated vault

**Increment B.3 — Pipeline Multi-Source Merge (RB-7)**
- Multi-source selection, merge key, merge strategies
- Merge preview and master data export
- Gate: 2+ source pipeline with merge works

**Increment B.4 — Quick Capture Ribbons**
- "Add Idea" and "Add Feedback" ribbon actions
- Quick Capture command with type selector
- Configurable target folders and custom types
- Gate: Ribbon actions create typed notes in configured folders

### Phase C: Polish & Submission

- Final testing across all features
- Update `manifest.json` version
- Create `versions.json` for Obsidian compatibility
- Submit to Obsidian community plugin review

## Dependency Graph

```
RB-1 (Repo Restructure)
  └── RB-2 (ESLint Compliance)
       └── CI/CD Pipeline
            └── Phase C (Submission)

RB-3 (Canvas Importer) ──┐
RB-4 (Seed Content) ─────┤
RB-7 (Pipeline Merge) ───┤── Phase C
Quick Capture ────────────┘
```

## Related

- [[Release Preparation PRD]]
- [[Obsidian Canvas Integration PRD]]
- [[Installer PRD]]
- [[Data Exchange Hub PRD]]
- [[Quick Capture PRD]]
