---
type: ProductBacklogItem
feature: "[[Installer PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-001 First Run Setup]]"
tags:
  - release-blocker
  - RB-4
  - installer
  - onboarding
planned_in: "[[Cycle 12 - Release Preparation]]"
user_story: "[[Installer should seed starter content on first run]]"
---

## User Story - Problemspace

As a new Flowti user, I want my vault populated with example content on first run so that I can see a living system immediately and understand how to use it.

### User Pains

- After first-run install, users see 23 empty folders and no content
- Knowledge graph is empty — no domains, events, flows to explore
- Sessions have no templates — new users cannot experience sessions without manual setup
- No welcome note or getting-started guidance

### User Needs

- Example domain with sample events and flows in Event Catalog
- Pre-built session templates for common activities
- Welcome note in inbox with getting-started guidance
- Seed content that is idempotent (safe to re-run)

## Solutionstatement

### Functional Requirements

- [ ] New `SeedContentStep` in installer pipeline (order 30, after FolderScaffoldStep)
- [ ] Example domain: "Getting Started" with 2-3 sample events and 1 flow
- [ ] Session templates: Daily Session, Domain Design, Retrospective (at minimum)
- [ ] Welcome note: `00 - Inbox/Welcome to Flowti.md` with quickstart guide
- [ ] Seed content stored in `var/config/installer/v1/seed/`
- [ ] Idempotent execution: skip if seed content already exists

### Technical Requirements

- `SeedContentStep` implements `IInstallerStep` with order 30
- Seed files are JSON templates in `var/config/installer/v1/seed/`
- Step uses `fileSystemClient` for file creation
- Skip logic checks for existence of key files (welcome note, example domain)

## Acceptance Criteria

- [ ] First-run creates populated example domain in Event Catalog
- [ ] At least 3 session templates available immediately after install
- [ ] Welcome note exists in inbox after install
- [ ] Seed content is idempotent (re-running skips existing)
- [ ] Step integrates into existing installer pipeline
- [ ] npm run build passes

## Related

- PRD: [[Installer PRD]]
- Inbox: [[Installer should seed starter content on first run]]
