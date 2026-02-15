---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L0
business_value: 3
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 4
design_cost: 4
test_cost: 3
priority: 1
---

# PRD: The Designer

> Architecture reference: [[The Designer]]

---

## 1. Problem Statement

Teams starting or continuing product, service, or software design lack a centralized workspace inside Flowti. Design activities are scattered across external tools (Figma, Miro, whiteboards), disconnected from the event-driven architecture, data models, and PRDs that Flowti manages. This fragmentation causes loss of design rationale and broken traceability from design decisions to implementation artifacts.

---

## 2. Outcome

After implementation, users will have:

- A dedicated design workspace within Flowti for starting or continuing design work
- Design artifacts linked to domains, events, and PRDs
- A structured design process that captures rationale alongside deliverables
- Traceability from design decisions through to implementation

---

## 3. Scope

### In Scope
- Design workspace view within Flowti (canvas or structured editor)
- Design session management (start, resume, complete)
- Linking design artifacts to domains, events, and PRDs
- Design rationale capture (decision log)
- Template scaffolds for common design activities (service blueprint, UI wireframe, flow diagram)

### Out of Scope
- Full visual design tool (Figma replacement)
- Real-time collaboration
- Image/vector editing capabilities
- Design system token management
- Prototyping or interactive preview

---

## 4. UX Entry Points

- **Product Hub**: "Start Design Session" action
- **PRD Detail View**: "Open in Designer" link
- **Command Palette**: `Flowti: Open Designer`
- **Domain Hub**: "Design this domain" context action

---

## 5. Functional Requirements

- [ ] Create a new design session linked to a domain or PRD
- [ ] Resume an existing design session
- [ ] Capture design rationale as structured notes
- [ ] Link design artifacts to events in the Event Catalog
- [ ] Generate design document with frontmatter metadata
- [ ] Support design templates (service blueprint, UI layout, data flow)
- [ ] Mark design session as complete with summary

---

## 6. Data Model Impact

New entities:

```
design_session
  session_id
  title
  status (active|paused|completed)
  linked_prd_id
  linked_domain
  template_type
  rationale_entries[]
  artifact_paths[]
  created_at
  updated_at
```

Persisted as markdown files with YAML frontmatter in the documentation tree.

---

## 7. Event Impact

**Produced**:
- `design.session.started`
- `design.session.updated`
- `design.session.completed`
- `design.artifact.created`

**Consumed**:
- `prd.created` (to suggest design sessions)
- `doc.updated` (to refresh linked artifacts)

---

## 8. UI Layout Impact

- New view: `DesignerView` — split layout with canvas/editor and inspector dock
- Product Hub Dashboard: "Active Design Sessions" card
- PRD detail panel: "Design" tab or link

---

## 9. Adapter Impact

- New: `DesignerAdapter` or `DesignSessionService` to manage session lifecycle
- `ProductHubAdapter`: add design session aggregation
- Methods: `startSession()`, `resumeSession()`, `completeSession()`, `linkArtifact()`

---

## 10. Non-Functional Requirements

- Design sessions must persist and survive plugin reload
- Must not require external dependencies or network access
- File-based storage using markdown with YAML frontmatter
- Must respect folder conventions and naming standards

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Scope creep toward full design tool | Strict v1 scope; text + structure only |
| Low adoption if too abstract | Provide concrete templates |
| Design artifacts become stale | Link to events for change detection |
| Overlap with existing canvas plugin | Position as structured design, not freeform |

---

## 12. Acceptance Criteria

- [ ] User can start a design session from Product Hub
- [ ] User can link a design session to a PRD
- [ ] Design rationale is captured as structured entries
- [ ] Design artifacts are saved as markdown with proper frontmatter
- [ ] Session status transitions work (active, paused, completed)
- [ ] Design session appears in related PRD cross-references

---

## 13. Definition of Done

- [ ] DesignerAdapter/Service implemented with session lifecycle
- [ ] Design session view integrated into Product Hub
- [ ] At least 2 design templates provided (service blueprint, UI layout)
- [ ] Event integration working (produced events emitted)
- [ ] Documentation updated
- [ ] Tests for session service and artifact generation
