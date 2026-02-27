---
type: ReleaseBlocker
feature: "[[Release Preparation PRD]]"
stage: deferred
priority: low
tags:
  - release-blocker
  - RB-6
  - installer
decision: defer-v1.1
decision_date: 2026-02-27
decision_cycle: "[[Cycle 49 - Release Readiness and Dogfooding]]"
---

## RB-6: CLI Installer

### Description

Provide a command-line installer alternative to the existing wizard-based installer. This would allow headless setup, scripted vault provisioning, and CI-friendly installation.

### Decision

**Defer to v1.1.** The existing 4-page installer wizard (InstallerWizardModal) is fully functional and sufficient for marketplace v1.0. A CLI alternative is a convenience feature, not a release requirement.

### Rationale

1. **Wizard works**: The installer wizard handles user creation, folder scaffolding, and seed content — all first-run requirements are met.
2. **No marketplace requirement**: Obsidian community plugin guidelines do not require a CLI installer.
3. **Low demand signal**: No inbox items or user pain signals requesting CLI installation.
4. **Investment better spent elsewhere**: Cycles 49-54 prioritize architecture debt, dogfooding, and feature deepening — higher value-per-cycle than a CLI installer.

### Current State

- InstallerService: step-based pipeline executor with 2 steps (UserCreation, FolderScaffold)
- InstallerWizardModal: 4-page wizard (Welcome → User Profile → Folder Setup → Complete)
- Tests: installer domain fully tested

### Target

- **v1.1** — After marketplace release, if community feedback signals demand for CLI-based setup
- **No specific cycle assigned** — will be prioritized based on post-release feedback

### Related

- [[Release Preparation PRD]]
- [[Backlog Refinement - Post Cycle 48]]
- [[Cycle 49 - Release Readiness and Dogfooding]]
