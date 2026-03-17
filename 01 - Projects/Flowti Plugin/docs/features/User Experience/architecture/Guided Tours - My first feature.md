---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: Feature
stage: draft
owner:
related_hubs:
  - User Hub
  - Event Catalog
  - Project Hub
related_events:
  - idea.created
  - discovery.started
  - prd.created
  - prd.updated
  - technicalReview.completed
  - featureReadiness.updated
tags:
  - onboarding
  - guided-tour
  - prd
  - quality
---

# Feature: Guided Tour for your first Feature

## 1. Problem Statement

New users can *see* Flowti’s structure (Event Catalog, Hubs, Docs), but they don’t yet have a **repeatable path** to convert a raw idea into a **development-ready PRD** with the right quality gates (FRI, Technical Review, tests/docs intent).

This causes:
- incomplete or vague PRDs
- missing event/data/UI impact thinking
- late discovery of architectural violations
- inconsistent documentation updates

We need an interactive, guided workflow that teaches Flowti’s lifecycle **by doing**.

---

## 2. Outcome

After completing the guided tour, the user can:

- capture an idea from feedback and link it to a hub/domain
- run a lightweight discovery workflow
- draft a PRD one-pager using the standard template
- attach event + data model + UI impacts
- define increments (manageable chunks)
- run readiness scoring (FRI) and trigger a Technical Review session
- produce a “development_ready” PRD state with updated documentation

Success indicators:
- First PRD reaches `development_ready` with all mandatory gates satisfied
- User understands where artifacts live and how hubs connect to them
- Reduced back-and-forth in refinement for subsequent features

---

## 3. Scope

### In Scope (v1)
- Guided Tour flow (step-by-step) for “first feature”
- Interactive checklists and artifact generation helpers
- PRD one-pager creation with standardized frontmatter + metrics YAML block
- FRI scoring capture + status derivation
- Technical Review checklist execution (as a session artifact)
- Output: PRD marked `development_ready` and linked artifacts created

### Out of Scope (v1)
- Automated AI authoring of the entire PRD (assist only, don’t replace thinking)
- Full collaboration/multi-user workflow
- E2E testing automation
- Advanced analytics dashboards for readiness trends

---

## 4. UX Entry Points

Primary entry points:
- **User Hub → Dashboard**: “Start Guided Tour: Your First Feature”
- **Event Catalog**: “Turn this feedback into a Feature PRD”
- **Command Palette**: `Flowti: Start Guided Tour (First Feature)`

Default path:
1) User Hub → Start Tour  
2) Tour wizard creates Idea record  
3) Tour guides to Discovery notes  
4) Tour guides to PRD creation  
5) Tour guides to readiness scoring + technical review  
6) Tour finishes by publishing the PRD + links

---

## 5. Functional Requirements

### 5.1 Tour Orchestration
- [ ] User can start/stop/resume the tour
- [ ] Tour persists progress (steps completed)
- [ ] Tour supports “skip for now” per step, but flags missing gates
- [ ] Tour produces artifacts in consistent folders

### 5.2 Artifact Generation
- [ ] Create **Idea** record (note) with required metadata
- [ ] Create **Discovery** notes scaffold (problem, evidence, stakeholders)
- [ ] Create **PRD One-Pager** prefilled with references
- [ ] Insert **Feature Readiness YAML** block into PRD
- [ ] Create **Technical Review Session** note prefilled for the feature
- [ ] Create **Increment Plan** section (or separate note) with slice template

### 5.3 Guided Checklists
- [ ] Each step contains a checklist and completion criteria
- [ ] Final step contains a “Documentation updated?” mandatory checkbox
- [ ] Tour blocks “Finish” until mandatory checkboxes are complete (or explicitly deferred with a recorded reason)

### 5.4 Hub + Catalog Integration
- [ ] Idea and PRD are linked to a hub (domain selection)
- [ ] Tour can navigate user to relevant hub views (User Hub, Event Catalog, Project Hub)
- [ ] PRD references are discoverable from Event Catalog context

### 5.5 Readiness State
- [ ] Tour updates PRD frontmatter `stage` to `development_ready` when gates are satisfied
- [ ] Tour writes/updates FRI values and derived status

---

## 6. Data Model Impact

New/extended entities (conceptual):

```txt
tour_run
  tour_run_id
  user_id
  status (active|paused|completed|abandoned)
  current_step_id
  started_at
  completed_at
  linked_feature_id
  artifact_paths[]

feature_prd
  feature_id
  stage (draft|review|development_ready|approved|implemented)
  readiness_metrics (embedded YAML)
  linked_idea_id
  linked_domain/hub_id
````

Artifacts remain Markdown-first; persistence can be file-based + storage mirrors.

---

## 7. Event Impact

Produced events:

- `tour.started`
    
- `tour.step.completed`
    
- `tour.paused`
    
- `tour.completed`
    
- `idea.created`
    
- `discovery.started`
    
- `prd.created`
    
- `prd.updated`
    
- `featureReadiness.updated`
    
- `technicalReview.created`
    
- `technicalReview.completed`
    

Consumed events:

- `doc.created`, `doc.updated` (to reflect updates in UI)
    
- `ui.opened` / navigation events (for guided routing)
    

---

## 8. UI Layout Impact

Primary UI surface: **User Hub**.

Tabs affected:

- User Hub Dashboard: add “Guided Tour” card/module
    
- (Optional) User Hub Sessions: show “Active Tours” as a session-like item
    

Layout usage:

- User Hub Dashboard → `dashboard_grid`
    
- Tour Wizard → `session_focus` (recommended) OR modal-driven flow
    

Regions (recommended approach):

- Use `session_focus` for the guided tour runtime:
    
    - SessionHeaderRegion: step title + progress
        
    - WorkspaceRegion: instructions + checklist + links
        
    - NotesRegion: inline editor for artifacts
        
    - ArtifactsRegion: generated files list
        

---

## 9. Adapter Impact

Adapters:

- `UserHubAdapter`: add tour aggregation + entrypoint actions
    
- New: `GuidedTourAdapter` (or `OnboardingTourService`) to orchestrate steps
    

New methods (example):

- `startTour(type: "first_feature")`
    
- `resumeTour(tour_run_id)`
    
- `completeStep(step_id, evidence?)`
    
- `generateArtifact(kind, params)`
    
- `calculateReadiness(feature_id)`
    

---

## 10. Non-Functional Requirements

- Must not block normal user flow (tour is optional and dismissible)
    
- Must be resilient: can resume after restart
    
- Minimal coupling to UI components (event-driven)
    
- Artifacts must be idempotent (re-running step doesn’t duplicate docs)
    
- File creation must respect naming conventions and folder structure
    
- Performance: no vault-wide scans required for v1
    

---

## 11. Risks

|Risk|Mitigation|
|---|---|
|Tour feels too rigid|Allow skip + record deferral reason|
|Users treat it as bureaucracy|Keep steps minimal; show value and outcomes|
|Artifact sprawl|Standard folders + consistent naming + backlinks|
|Incomplete readiness but “finished”|Mandatory gates + explicit deferral logging|

---

## 12. Acceptance Criteria

-  User can start the Guided Tour from User Hub
    
-  Tour creates Idea, Discovery scaffolds, PRD one-pager, Tech Review note
    
-  PRD includes Feature Readiness YAML block
    
-  Tour guides user to fill required sections (problem, outcome, scope, events, data model, UI impact)
    
-  Tour ends with a checklist including “Documentation updated”
    
-  When all mandatory checks are done, PRD stage is updated to `development_ready`
    
-  Artifacts are linked together (idea ↔ discovery ↔ PRD ↔ review)
    

---

## 13. Definition of Done (v1)

-  Guided Tour flow implemented (start/resume/complete)
    
-  Artifact generation implemented and idempotent
    
-  FRI capture + status derivation implemented
    
-  Technical Review session template integrated
    
-  User Hub entry point implemented
    
-  Documentation for this feature added
    
-  Tests added for orchestration service + file generation helpers
    

---

## 14. Notes / Future Evolution

- “Guided Tour for your first Hub”
    
- “Guided Tour for your first Event Storming session”
    
- AI-assisted gap detection (missing PRD fields, weak acceptance criteria)
    
- Multi-user “Three Amigos guided session” mode
    
- Automatic creation of initial work items / increments in Project Hub