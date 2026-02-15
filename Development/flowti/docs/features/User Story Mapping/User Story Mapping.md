---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: Feature
stage: draft
owner:
related_hubs:
  - Product Hub
  - Project Hub
  - User Hub
related_events:
  - storyMap.created
  - storyMap.updated
  - storyMap.slice.created
  - backlog.item.generated
  - release.plan.updated
tags:
  - product
  - discovery
  - planning
  - user-story-mapping
---

# Feature PRD: User Story Mapping Tool

---

# 1. Executive Summary

The **User Story Mapping Tool** enables teams to visually structure user journeys, slice releases, and generate development-ready backlog items directly inside Flowti.

It bridges:

- Discovery → Structure  
- Structure → Increment Planning  
- Increment Planning → Development  

The tool will:

- Live inside Domain Hubs (primarily Product Hub)
- Connect to the Event Catalog
- Generate structured PRD slices
- Produce backlog-ready increments
- Feed the Knowledge Graph

This feature strengthens Flowti’s position as an **Integrated Business Development Environment (IBDE)** by making product slicing operational and traceable.

---

# 2. Problem Statement

Currently:

- Ideas become PRDs
- PRDs are broken into chunks manually
- Traceability from user journey → increment → event impact is fragmented
- Story mapping is external (Miro, FigJam, whiteboards)

We need a **native, event-aware Story Mapping tool** that:

- Structures user journeys
- Makes releases explicit
- Generates increments
- Maintains traceability
- Updates documentation automatically

---

# 3. Vision

> A Story Map is a structured representation of how users achieve value.
> It makes scope visible.
> It defines slices.
> It generates increments.

The tool must:

- Encourage thinking in user journeys
- Enable vertical slicing
- Integrate with PRD
- Feed backlog generation
- Stay aligned with event-driven architecture

---

# 4. Strategic Positioning in Flowti

Story Mapping sits between:

```

Idea → Discovery → PRD → Story Map → Increments → Development → Testing → Publish

```

It lives in:

- Product Hub
- Project Hub (optional view)
- Documentation Sessions

---

# 5. Scope

## In Scope (v1)

- Interactive Story Map board
- Hierarchical structure (Activities → Steps → Stories)
- Release slicing row
- Export slices into backlog items
- Link stories to events/entities
- Generate increment plan note
- Save map as markdown + metadata

## Out of Scope (v1)

- Real-time collaboration
- AI auto-generation
- Cross-project aggregation
- Velocity tracking
- Complex estimation systems

---

# 6. Functional Requirements

---

## 6.1 Story Map Structure

Structure:

```

Activity (horizontal backbone)  
└─ User Step  
└─ Story (card)

```

Release slices:

```

Release 1  
Release 2  
Release 3

```

Requirements:

- [ ] Create Activity column
- [ ] Add User Steps under Activity
- [ ] Add Stories under Step
- [ ] Drag & reorder stories
- [ ] Create Release slices (horizontal cut)
- [ ] Assign stories to releases
- [ ] Add acceptance criteria to stories
- [ ] Link story to:
  - Event(s)
  - Domain Entity
  - PRD section
  - Project

---

## 6.2 Backlog Generation

From a slice:

- [ ] Generate backlog items
- [ ] Create increment note
- [ ] Link to PRD
- [ ] Link to Project Hub
- [ ] Generate event stubs if missing

Backlog item must contain:

- Title
- Description
- Acceptance Criteria
- Linked Events
- Linked Entities
- Linked Story Map ID

---

## 6.3 Documentation Integration

Story Map generates:

- Story Map Markdown document
- Linked PRD references
- Increment plan note
- Knowledge graph relationships

---

## 6.4 Event Integration

Events:

- `storyMap.created`
- `storyMap.updated`
- `storyMap.slice.created`
- `storyMap.backlog.generated`

Stories can:

- Attach existing events
- Propose new event names (draft)
- Validate event naming convention

---

## 6.5 Hub Integration

Primary Hub: Product Hub

Secondary:

- Project Hub (when generating increments)
- User Hub (assigned slices)
- Documentation Sessions (Event Storming continuation)

---

# 7. UI Composition

## 7.1 Layout

Use:

- `HubWorkspaceLayout`
- `BoardLayout`
- `SplitDockLayout`

---

## 7.2 View Composition

```

StoryMapView  
├─ StoryMapHeader  
│ ├─ MapTitle  
│ ├─ ReleaseSelector  
│ ├─ GenerateBacklogButton  
│ └─ ExportButton  
│  
├─ StoryMapBoard  
│ ├─ ActivityColumn*  
│ │ └─ StepRow*  
│ │ └─ StoryCard*  
│  
└─ InspectorDock  
├─ StoryEditor  
├─ AcceptanceCriteriaEditor  
├─ LinkedEventsPanel  
├─ LinkedEntitiesPanel  
└─ ReleaseAssignmentPanel

```

---

## 7.3 Story Card Structure

```

story_id  
title  
description  
acceptance_criteria[]  
linked_events[]  
linked_entities[]  
release_tag  
status (draft|validated|ready)

```

---

# 8. Data Model

## Story Map

```

story_map_id  
hub_id  
linked_prd_id  
activities[]  
releases[]  
created_at  
updated_at

```

## Activity

```

activity_id  
title  
order

```

## Step

```

step_id  
activity_id  
title  
order

```

## Story

```

story_id  
step_id  
title  
description  
acceptance_criteria[]  
linked_events[]  
linked_entities[]  
release_id  
status

```

---

# 9. Non-Functional Requirements

- Must scale to 200+ stories
- Board must be virtualized
- Drag-and-drop must be performant
- No direct domain logic in UI layer
- Must respect HubAdapter boundaries
- Must be exportable as Markdown
- Must preserve ordering deterministically

---

# 10. UX Requirements

- Clean visual hierarchy
- Clear release slicing visualization
- Immediate feedback on missing acceptance criteria
- Event linking discoverable
- Backlog generation preview before commit
- Undo support (future)

---

# 11. Risks

| Risk | Mitigation |
|------|------------|
| Becomes visual clutter | Limit nesting depth |
| Performance degradation | Virtualized board |
| Duplicate event creation | Validate against Event Catalog |
| Over-complication | Strict MVP scope |
| Loss of structure on export | Deterministic Markdown schema |

---

# 12. Acceptance Criteria

- [ ] User can create Story Map from Product Hub
- [ ] User can add Activities, Steps, Stories
- [ ] User can create Release slices
- [ ] User can assign stories to release
- [ ] User can attach events/entities
- [ ] Backlog items generated correctly
- [ ] Increment plan created
- [ ] Knowledge graph updated
- [ ] PRD references updated

---

# 13. Definition of Done (v1)

- [ ] StoryMapAdapter implemented
- [ ] StoryMapView integrated into Product Hub
- [ ] BoardLayout configured
- [ ] Story data persisted in Markdown
- [ ] Backlog generation working
- [ ] Event linking working
- [ ] Documentation updated
- [ ] Tests for StoryMapService + generation logic

---

# 14. Future Evolution

- AI-assisted story slicing
- Estimation fields
- Velocity tracking
- Cross-release comparison
- Export to Azure DevOps
- Three Amigos scoring integration
- Architecture impact heatmap
- Release risk analysis

---

# 15. Conceptual Summary

Story Mapping becomes:

```

PRD → Structured Journey → Vertical Slice → Increment → Event Impact → Development

```

It transforms:

- Static documentation
- Into actionable scope
- Into traceable increments
- Inside Flowti
