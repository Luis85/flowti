---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: "Cycle 5+ (tentative)"
priority: medium
effort: large
dependencies:
  - "[[PBI-SW-003 Session Types]]"
user_story: "[[I want to have a Domain Design Session, so that I can easily document a new domain]]"
note: "Rich guided workflow for domain decomposition when session type = 'domain-design'. Requires PBI-SW-003 foundation (type configs, guiding questions). PBI-SW-003 delivered in Cycle 2 — unblocked. Deferred to Cycle 5+ to prioritize PBI-SW-007 (daily session, higher user demand)."
tags:
  - backlog
---

## User Story — Problem Space

As a domain architect, I want a guided Domain Design Session so that I can systematically decompose a new domain into services, events, flows, and actors with structured documentation.

### User Pains

- Domain decomposition is ad-hoc — no structured workflow for documenting a new domain
- Must manually create entity docs (services, events, flows, actors) one at a time
- No guided prompts to ensure completeness — easy to miss bounded contexts or cross-cutting events
- Session workspace doesn't adapt its tooling based on the type of work being done
- Navigating between the Event Catalog and session workspace during domain design is disruptive

### User Needs

- Guided prompts that walk through domain decomposition step by step
- Auto-create domain entity docs during the session (domains, services, events, flows, actors)
- Session summary includes the domain decomposition structure
- Cross-hub navigation to Event Catalog during the session
- Decompose "up, down, left, right" from any entity — navigate relationships

## Solution Statement

### Use Cases

**Flow:**
User creates a session with type "Domain Design" → workspace shows guided decomposition prompts → user names the domain → defines services → identifies events per service → maps flows → assigns actors → entity docs are auto-created in the vault → session summary includes the full domain structure

**Gherkin:**
```gherkin
Given the user starts a Domain Design session for "Payment Processing"
When they follow the guided prompts to identify services
And define events for each service
And map flows between services
Then domain entity docs are created in the Documentation folder
And the session summary shows the full decomposition structure
And all entities are cross-linked via wikilinks
```

### Functional Requirements

**Guided workflow (workspace UI):**
- [ ] Domain Design workspace panel with step-by-step guided prompts
- [ ] Steps: Name Domain → Identify Services → Define Events → Map Flows → Assign Actors → Review
- [ ] Each step has guiding questions from `SessionTypeConfig` (PBI-SW-003)
- [ ] Progress indicator showing current step and completion state
- [ ] Navigation between steps (back/forward)

**Entity creation:**
- [ ] Auto-create domain doc via `FileSystemClient.createFile()` with frontmatter
- [ ] Auto-create service docs for each identified service
- [ ] Auto-create event docs for each identified event
- [ ] Auto-create flow docs for mapped flows
- [ ] Cross-link all entities via wikilinks in frontmatter
- [ ] Entity docs created in configured `docsRootPath` folder structure

**Cross-hub navigation:**
- [ ] "Open in Event Catalog" button for events created during session
- [ ] "View Domain" button navigates to the domain doc in the Event Catalog domains tab
- [ ] Bidirectional: Event Catalog shows "Created in session: {title}" badge

**Session summary:**
- [ ] Domain decomposition structure included in session summary
- [ ] Entity count summary: N services, M events, K flows, J actors
- [ ] Entity list with wikilinks for navigation

### Technical Requirements

- Builds on PBI-SW-003 `SessionTypeConfig` for `"domain-design"` type definition
- Guided workflow is a workspace panel component — follows existing `renderMaster()`/`renderDetail()` pattern
- Entity creation uses existing `FileSystemClient.createFile()` + `normalizeDocFrontmatter()`
- Cross-links use existing wikilink conventions from the Event Catalog documentation system
- `metadataCache` timing caveat applies (L-metadataCache): use `setTimeout` after file creation

### Constraints

- Requires PBI-SW-003 to be delivered first (type config infrastructure)
- Entity docs follow existing documentation folder structure (`docsRootPath`)
- Domain Design session type is one of the pre-built types in PBI-SW-003
- Does not modify Event Catalog view — cross-hub navigation uses existing `openHub()` mechanism

## Acceptance Criteria

- [ ] Starting a "Domain Design" session shows guided decomposition workflow
- [ ] Each guided step presents relevant questions and input fields
- [ ] Naming a domain auto-creates a domain doc in the vault
- [ ] Identifying services creates service docs linked to the domain
- [ ] Defining events creates event docs linked to their service
- [ ] Mapping flows creates flow docs with step sequences
- [ ] All entities cross-linked via wikilinks
- [ ] "Open in Event Catalog" navigates to the relevant catalog tab
- [ ] Session summary includes domain decomposition structure
- [ ] Entity docs created in configured documentation root path
- [ ] `npm run build` passes with all tests green

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | No | Depends on PBI-SW-003 for type config infrastructure |
| **N**egotiable — scope can be adjusted without losing core value | Yes | Cross-hub navigation and summary can be deferred; guided creation is core |
| **V**aluable — delivers user-facing or architectural value | Yes | High user value — structured domain documentation workflow |
| **E**stimable — effort and scope are understood | Partial | Guided UI is novel; spike may be needed for step navigation UX |
| **S**mall — deliverable in 1-3 increments | Yes | Inc 1: guided steps + entity creation, Inc 2: cross-hub nav + summary, Inc 3: relationship navigation |
| **T**estable — acceptance criteria are verifiable | Yes | Entity creation testable; guided workflow testable via DOM assertions |

## Related

- PRD: [[Session Workspaces PRD]]
- User Story: [[I want to have a Domain Design Session, so that I can easily document a new domain]]
- PBI-SW-003: [[PBI-SW-003 Session Types]] (provides type config foundation)
- Event Catalog: [[EventCatalogView]] (cross-hub navigation target)
- Documentation Root: `docsRootPath` setting (entity doc location)
