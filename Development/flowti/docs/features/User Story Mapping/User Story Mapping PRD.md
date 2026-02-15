---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events:
  - storyMap.created
  - storyMap.updated
  - storyMap.slice.created
  - backlog.item.generated
  - release.plan.updated
maturity: L1
business_value: 4
implementation_cost: 4
maintenance_cost: 2
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 3
---

# PRD: User Story Mapping Tool

> Architecture reference: [[User Story Mapping]]

---

## 1. Problem Statement

Ideas become PRDs and PRDs are broken into increments manually, but traceability from user journey to increment to event impact is fragmented. Story mapping is done externally (Miro, FigJam, whiteboards), disconnected from Flowti's event-driven architecture. We need a native, event-aware Story Mapping tool that structures user journeys, makes releases explicit, generates increments, and maintains traceability.

---

## 2. Outcome

After implementation, teams can:

- Visually structure user journeys as story maps inside Flowti
- Slice releases with clear scope boundaries
- Generate development-ready backlog items from slices
- Maintain full traceability from journey to increment to event impact
- Keep story maps aligned with PRDs and the Event Catalog

---

## 3. Scope

### In Scope
- Interactive Story Map board with hierarchical structure (Activities > Steps > Stories)
- Release slicing rows (horizontal cuts)
- Export slices into backlog items with linked events/entities
- Generate increment plan notes
- Save map as markdown with metadata
- Link stories to events and domain entities

### Out of Scope
- Real-time collaboration
- AI auto-generation of stories
- Cross-project aggregation
- Velocity tracking or estimation systems

---

## 4. UX Entry Points

- **Product Hub**: "Create Story Map" action (primary)
- **Project Hub**: Story Map view (when generating increments)
- **PRD Detail**: "Map Stories" link
- **Command Palette**: `Flowti: Open Story Map`

---

## 5. Functional Requirements

- [ ] Create Activity columns (horizontal backbone)
- [ ] Add User Steps under Activities
- [ ] Add Story cards under Steps
- [ ] Drag and reorder stories
- [ ] Create Release slices (horizontal cuts)
- [ ] Assign stories to releases
- [ ] Add acceptance criteria to stories
- [ ] Link stories to events, domain entities, PRD sections, and projects
- [ ] Generate backlog items from a release slice
- [ ] Create increment plan note linked to PRD and Project Hub
- [ ] Generate event stubs for missing events
- [ ] Save story map as markdown document with YAML frontmatter

---

## 6. Data Model Impact

New entities:

```
story_map: story_map_id, hub_id, linked_prd_id, activities[], releases[]
activity: activity_id, title, order
step: step_id, activity_id, title, order
story: story_id, step_id, title, description, acceptance_criteria[],
       linked_events[], linked_entities[], release_id, status (draft|validated|ready)
```

Backlog item contains: title, description, acceptance criteria, linked events, linked entities, linked story map ID.

---

## 7. Event Impact

**Produced**: `storyMap.created`, `storyMap.updated`, `storyMap.slice.created`, `storyMap.backlog.generated`

**Consumed**: Events from Event Catalog (for story-event linking and validation)

Stories can attach existing events, propose new event names (draft), and validate naming conventions.

---

## 8. UI Layout Impact

- `StoryMapView` using `HubWorkspaceLayout` + `BoardLayout` + `SplitDockLayout`
- Components: `StoryMapHeader` (title, release selector, generate/export buttons), `StoryMapBoard` (activity columns > step rows > story cards), `InspectorDock` (story editor, acceptance criteria, linked events/entities, release assignment)
- Product Hub: new "Story Maps" tab or card

---

## 9. Adapter Impact

- New: `StoryMapAdapter` / `StoryMapService` — manages map CRUD, story lifecycle, backlog generation
- `ProductHubAdapter`: add story map aggregation
- `ProjectHubAdapter`: receive generated increments
- Methods: `createMap()`, `addActivity()`, `addStep()`, `addStory()`, `createSlice()`, `generateBacklog()`

---

## 10. Non-Functional Requirements

- Must scale to 200+ stories per map
- Board must be virtualized for performance
- Drag-and-drop must be responsive
- No direct domain logic in UI layer (respect HubAdapter boundaries)
- Must be exportable as markdown
- Must preserve ordering deterministically

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Visual clutter with large maps | Limit nesting depth; collapsible sections |
| Performance degradation | Virtualized board rendering |
| Duplicate event creation | Validate against Event Catalog |
| Over-complication of MVP | Strict v1 scope |
| Loss of structure on export | Deterministic markdown schema |

---

## 12. Acceptance Criteria

- [ ] User can create Story Map from Product Hub
- [ ] User can add Activities, Steps, and Stories
- [ ] User can create Release slices and assign stories
- [ ] User can attach events and entities to stories
- [ ] Backlog items generated correctly from slices
- [ ] Increment plan note created and linked
- [ ] Knowledge graph updated with story map relationships
- [ ] PRD references updated
- [ ] Story map persisted as markdown

---

## 13. Definition of Done

- [ ] StoryMapAdapter/Service implemented
- [ ] StoryMapView integrated into Product Hub
- [ ] BoardLayout configured and rendering
- [ ] Story data persisted in markdown
- [ ] Backlog generation working end-to-end
- [ ] Event linking and validation working
- [ ] Documentation updated
- [ ] Tests for StoryMapService and generation logic
