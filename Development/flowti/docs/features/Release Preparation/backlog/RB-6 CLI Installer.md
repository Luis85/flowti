---
type: ReleaseBlocker
feature: "[[Release Preparation PRD]]"
stage: closed
priority: low
tags:
  - release-blocker
  - RB-6
  - installer
decision: superseded
decision_date: 2026-03-01
decision_cycle: "[[Cycle 54 - Canvas Sessions and Signal Hardening]]"
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

### Cycle 54 Formal Reassessment (2026-03-01)

**Decision: Close as Superseded.**

The Obsidian 1.12 official CLI fully covers the headless/CI use case that RB-6 was designed for. Cycle 53 validated this through 69 E2E tests using the CLI for plugin lifecycle management. The remaining gap (user profile + folder scaffold) is narrow:

1. **Official CLI covers**: `plugin:enable`, `plugin:disable`, `plugin:reload`, `plugin:install`, `eval` (arbitrary JS) — all verified in C53 E2E harness
2. **Wizard covers**: user creation, folder scaffolding, seed content — these are first-run UX concerns, not CLI automation concerns
3. **CLI wrapper tested**: 46 unit tests (C53 + C54) validate the ObsidianCli wrapper with full error path coverage
4. **Gap is scriptable**: For automated setup, a shell script calling `obsidian eval code="..."` can scaffold folders and set properties — no custom CLI installer needed

RB-6 is formally **closed as superseded** by the Obsidian 1.12 official CLI. No further action required.

### Related

- [[Release Preparation PRD]]
- [[Backlog Refinement - Post Cycle 48]]
- [[Cycle 49 - Release Readiness and Dogfooding]]
- [[Cycle 53 - Obsidian CLI Spike]]
- [[ADR-028 Obsidian CLI for Automated Testing]]
