---
type: DocumentType
name: Persona
abbreviation: ""
folder: ""
icon: user-circle
---

# Persona

A **Persona** is a documented archetype of a real user. Personas ground all design and prioritization decisions in real user context — who they are, what drives them, and where they struggle.

Every feature, flow, and priority should trace back to a persona need. We build for documented users, not imagined ones.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Persona"` | yes | Document type discriminator |
| `domain` | string | yes | Primary domain this persona interacts with |
| `stage` | enum | yes | `draft` · `done` |
| `plugin` | wikilink | no | Link to plugin README |
| `description` | string | no | One-line summary of who this persona is |
| `related_domains` | string[] | no | Domains this persona touches |
| `related_features` | wikilink[] | no | Features this persona uses |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Identity (Name & Role + Archetype + Quote + Profile Summary)
2. Goals & Motivations (Primary Goals table + Success Criteria)
3. Pain Points & Frustrations (Current Pain Points table + Breaking Points)
4. Context & Environment (Tools & Technologies + Workflow Context + Constraints)
5. Behavioral Patterns (Decision Style + Information Seeking + Error Recovery)
6. Domain Interaction Map (Domain Touchpoints + Cross-Domain Journeys)
7. Related Artifacts (JTBDs + User Stories + Features Used)
8. Review Log

## Lifecycle

```
draft → done
```

- **draft**: Initial persona captured, needs validation
- **done**: Persona validated against real user observations

## Minimum Viable Persona

Sections 1-3 (Identity, Goals, Pain Points) are the minimum viable persona. Sections 4-6 add operational depth for design and prioritization work.

## Connection to Other Types

| Connected Type | Relationship |
|---------------|-------------|
| [[JobToBeDone]] | Personas have jobs; JTBDs reference their persona |
| [[UserStory]] | Stories are written from a persona's voice |
| [[ProductRequirementsDocument]] | PRDs list personas in their Personas section |
