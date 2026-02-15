---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events:
  - idea.created
  - discovery.started
  - prd.created
  - prd.updated
  - technicalReview.completed
  - featureReadiness.updated
maturity: L1
---

# PRD: User Experience — Guided Tours

> Architecture reference: [[Guided Tours - My first feature]]

---

## 1. Problem Statement

New users can see Flowti's structure (Event Catalog, Hubs, Docs) but lack a repeatable path to convert a raw idea into a development-ready PRD with proper quality gates (FRI, Technical Review, tests/docs intent). This leads to incomplete PRDs, missing impact analysis, late architectural violations, and inconsistent documentation.

---

## 2. Outcome

After completing the guided tour, the user can:

- Capture an idea and link it to a hub/domain
- Run a lightweight discovery workflow
- Draft a PRD one-pager using the standard template with event, data model, and UI impacts
- Run readiness scoring (FRI) and trigger a Technical Review session
- Produce a `development_ready` PRD with updated documentation and linked artifacts

---

## 3. Scope

### In Scope
- Guided Tour flow (step-by-step) for "My First Feature"
- Interactive checklists and artifact generation helpers
- PRD one-pager creation with standardized frontmatter and metrics YAML
- FRI scoring capture and status derivation
- Technical Review checklist execution as a session artifact
- Output: PRD marked `development_ready` with linked artifacts

### Out of Scope
- Automated AI authoring of the entire PRD
- Full collaboration/multi-user workflow
- E2E testing automation
- Advanced analytics dashboards for readiness trends

---

## 4. UX Entry Points

- **User Hub Dashboard**: "Start Guided Tour: Your First Feature" card
- **Event Catalog**: "Turn this feedback into a Feature PRD" action
- **Command Palette**: `Flowti: Start Guided Tour (First Feature)`

Tour flow: User Hub > Start Tour > Create Idea > Discovery notes > PRD creation > Readiness scoring + Technical Review > Publish PRD + links

---

## 5. Functional Requirements

- [ ] User can start, stop, and resume the tour
- [ ] Tour persists progress (steps completed) across sessions
- [ ] Tour supports "skip for now" per step with flagged missing gates
- [ ] Create Idea record with required metadata
- [ ] Create Discovery notes scaffold (problem, evidence, stakeholders)
- [ ] Create PRD One-Pager prefilled with references
- [ ] Insert Feature Readiness YAML block into PRD
- [ ] Create Technical Review Session note
- [ ] Create Increment Plan section with slice template
- [ ] Each step has a checklist with completion criteria
- [ ] Final step has mandatory "Documentation updated?" checkbox
- [ ] Tour blocks "Finish" until mandatory checks complete or are explicitly deferred
- [ ] Idea and PRD linked to a hub via domain selection
- [ ] Tour updates PRD frontmatter `stage` to `development_ready` when gates pass

---

## 6. Data Model Impact

New entities:

```
tour_run
  tour_run_id, user_id, status (active|paused|completed|abandoned)
  current_step_id, started_at, completed_at
  linked_feature_id, artifact_paths[]

feature_prd
  feature_id, stage (draft|review|development_ready|approved|implemented)
  readiness_metrics (embedded YAML)
  linked_idea_id, linked_domain/hub_id
```

Artifacts are markdown-first; persistence is file-based with storage mirrors.

---

## 7. Event Impact

**Produced**: `tour.started`, `tour.step.completed`, `tour.paused`, `tour.completed`, `idea.created`, `discovery.started`, `prd.created`, `prd.updated`, `featureReadiness.updated`, `technicalReview.created`, `technicalReview.completed`

**Consumed**: `doc.created`, `doc.updated` (UI refresh), `ui.opened` (guided routing)

---

## 8. UI Layout Impact

- **User Hub Dashboard**: add "Guided Tour" card in `dashboard_grid`
- **Tour Wizard**: uses `session_focus` layout with regions:
  - SessionHeaderRegion: step title + progress bar
  - WorkspaceRegion: instructions + checklist + links
  - NotesRegion: inline editor for artifacts
  - ArtifactsRegion: generated files list

---

## 9. Adapter Impact

- `UserHubAdapter`: add tour aggregation and entrypoint actions
- New: `GuidedTourAdapter` (or `OnboardingTourService`) to orchestrate steps
- Methods: `startTour(type)`, `resumeTour(id)`, `completeStep(stepId, evidence?)`, `generateArtifact(kind, params)`, `calculateReadiness(featureId)`

---

## 10. Non-Functional Requirements

- Tour must not block normal user flow (optional and dismissible)
- Must resume after plugin restart
- Minimal UI coupling (event-driven orchestration)
- Artifacts must be idempotent (re-running step does not duplicate docs)
- File creation respects naming conventions and folder structure
- No vault-wide scans required for v1

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Tour feels too rigid | Allow skip + record deferral reason |
| Users treat it as bureaucracy | Keep steps minimal; show value and outcomes |
| Artifact sprawl | Standard folders + consistent naming + backlinks |
| Incomplete readiness but "finished" | Mandatory gates + explicit deferral logging |

---

## 12. Acceptance Criteria

- [ ] User can start the Guided Tour from User Hub
- [ ] Tour creates Idea, Discovery scaffolds, PRD one-pager, Tech Review note
- [ ] PRD includes Feature Readiness YAML block
- [ ] Tour guides user to fill required sections (problem, outcome, scope, events, data model, UI impact)
- [ ] Tour ends with a checklist including "Documentation updated"
- [ ] When all mandatory checks pass, PRD stage updates to `development_ready`
- [ ] Artifacts are linked together (idea <> discovery <> PRD <> review)

---

## 13. Definition of Done

- [ ] Guided Tour flow implemented (start/resume/complete)
- [ ] Artifact generation implemented and idempotent
- [ ] FRI capture and status derivation implemented
- [ ] Technical Review session template integrated
- [ ] User Hub entry point implemented
- [ ] Documentation for this feature added
- [ ] Tests added for orchestration service and file generation helpers
