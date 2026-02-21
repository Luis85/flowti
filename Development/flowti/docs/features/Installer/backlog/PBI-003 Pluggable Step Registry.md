---
type: ProductBacklogItem
feature: "[[Installer PRD]]"
stage: discovery
priority: low
dependencies:
  - "[[PBI-002 Seed Starter Content]]"
tags:
  - installer
  - extensibility
user_story: "[[Installer step registry should support pluggable steps from config]]"
---

## User Story - Problemspace

As a power user, I want to define custom installer steps in configuration so that I can extend the first-run setup without modifying source code.

### User Pains

- InstallerService has `registerStep()` but steps are registered programmatically
- No way for users or community contributors to add installer steps without code changes
- Custom vault setups (team-specific folders, templates, integrations) require source modification

### User Needs

- JSON-based step configuration file
- Steps declared in config file loaded by InstallerService
- Future: custom step plugin interface for community contributions

## Solutionstatement

### Functional Requirements

- [ ] Steps configuration file: `var/config/installer/v1/steps.json`
- [ ] Configuration schema:
  ```json
  {
    "steps": [
      { "id": "user-creation", "order": 10, "builtin": true },
      { "id": "folder-scaffold", "order": 20, "builtin": true },
      { "id": "seed-content", "order": 30, "builtin": true }
    ]
  }
  ```
- [ ] InstallerService loads step config and registers steps in declared order
- [ ] Built-in steps resolved by ID from internal registry
- [ ] Unknown step IDs logged as warnings (graceful degradation)

## Acceptance Criteria

- [ ] Steps loaded from config file when present
- [ ] Built-in steps work without config file (backward compatible)
- [ ] Unknown step IDs produce warning, don't halt pipeline
- [ ] npm run build passes

## Related

- PRD: [[Installer PRD]]
- Inbox: [[Installer step registry should support pluggable steps from config]]
- Depends: [[PBI-002 Seed Starter Content]]
