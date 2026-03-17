---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C4
title: Filter Office lock files
persona: Collaborator (Chris)
jtbd: Ignore lock files
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-17
---
# US-C4: Filter Office lock files

> JTBD: Ignore lock files | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** Office lock files (`~$*.docx`, `~$*.xlsx`) filtered out,
**so that** my vault isn't polluted with temp artifacts from colleagues.

## Acceptance Criteria

- [ ] `createIgnoredMatcher()` matches `~$` prefixed files
- [ ] Lock files are never imported into the vault
- [ ] The actual document file (e.g. `proposal.docx`) is not affected
