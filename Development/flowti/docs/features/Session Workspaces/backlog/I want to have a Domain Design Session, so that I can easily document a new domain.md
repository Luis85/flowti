---
type: UserStory
feature: "[[Session Workspaces PRD]]"
stage: captured
priority: medium
persona: Domain Architect
domain: Session
journey: Domain Documentation
jtbd: "When starting domain documentation, I want a pre-configured session that guides me through decomposition"
parent: "[[PBI-SW-003 Session Types]]"
source: inbox
---

## User Story

As a domain architect, I want to start a Domain Design Session so that I can systematically document a new domain by decomposing it into its constituent parts.

### Context (from inbox)

A domain consists of at least Services, Events, and Flows. Every entity can relate to Actors. While editing a domain entity, I always need to be able to add Actors to it.

I want to decompose a flow into its steps/tasks and attach Actors, Requirements, User Stories, and Notes to each step. I want to decompose every unit related to this domain to further deepen my documentation — decompose up, down, left, and right from a single entity.

### User Needs

- A session type "Domain Design" that pre-configures the workspace for domain documentation
- Guided flow: create domain doc, then services, then events, then flows
- Context-aware sidebar showing related entities as I work
- Ability to link Actors to any entity during the session
- Session summary showing the domain decomposition tree produced

### Acceptance Criteria

```gherkin
Scenario: Start a Domain Design Session
  Given I create a new session
  When I select type "Domain Design"
  Then the workspace loads with domain documentation tools
  And guiding questions prompt me to decompose the domain

Scenario: Domain decomposition produces linked entities
  Given I am in a Domain Design Session
  When I create a Service entity within the domain
  Then the service is linked to the domain
  And the session tracks the service as an artifact
```
