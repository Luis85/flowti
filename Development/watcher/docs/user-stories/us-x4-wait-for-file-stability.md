---
parent: "[[Content Creator|Content Creator]]"
domain: Folder Watcher
id: US-X4
title: Wait for file stability
persona: Content Creator (Max)
jtbd: Survive partial uploads
journey: "[[Development/watcher/docs/journeys/journey-5-sync-across-devices|Journey 5]]"
use-cases:
  - UC-25
---
# US-X4: Wait for file stability

> JTBD: Survive partial uploads | Persona: [The Content Creator](Content%20Creator.md) | Journey: [Journey 5](../journeys/journey-5-sync-across-devices.md)

**As a** content creator,
**I want** the plugin to wait for a file to stabilize before syncing,
**so that** I don't import a half-written file into the vault.

## Acceptance Criteria

- [ ] Stability checks compare mtime+size across multiple intervals (`stabilityChecks`, `stabilityCheckInterval`)
- [ ] A file whose mtime or size is still changing is not synced
- [ ] Once stable, the file proceeds through the normal sync pipeline
