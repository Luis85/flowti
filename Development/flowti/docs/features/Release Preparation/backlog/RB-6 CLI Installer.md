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

### Cycle 53 Update

Obsidian 1.12 (released 2026-02-27) introduced an official CLI with `plugin:enable`, `plugin:disable`, and `plugin:reload` commands. For headless/scripted vault provisioning, these commands cover the use case RB-6 was targeting:

```
obsidian plugin:install id=flowti-ibde enable
obsidian plugin:enable id=flowti-ibde
obsidian plugin:reload id=flowti-ibde
```

The wizard installer remains the recommended first-run path for new users (it creates user profiles, scaffolds folders, and seeds content — none of which the CLI covers). However, for automated setup and CI scenarios, the official CLI effectively supersedes the need for a custom CLI installer.

**Reassessment**: RB-6 remains deferred. The official CLI reduces the gap further. If community demand arises post-release, the remaining gap (user profile + folder scaffold via CLI) could be addressed with a simple script wrapping the official CLI commands.

### Related

- [[Release Preparation PRD]]
- [[Backlog Refinement - Post Cycle 48]]
- [[Cycle 49 - Release Readiness and Dogfooding]]
- [[Cycle 53 - Obsidian CLI Spike]]
- [[ADR-028 Obsidian CLI for Automated Testing]]
