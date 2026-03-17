---
stage: idea
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
priority: medium
phase: 4
dependencies:
  - "[[TD-49 Layout abstraction layer]]"
  - "[[TD-50 Workspace shell layout]]"
  - "[[TD-54 Event Catalog hub migration]]"
---

## User Story - Problemspace

As a project manager, I want a Project Hub so that I can manage work items, track project progress, and run documentation sessions within a project-scoped workspace.

### User Pains

- Project work items (tasks, milestones) scattered across vault notes
- No aggregated project dashboard with progress KPIs
- No project-scoped documentation sessions
- Manual tracking of what's been documented vs what's pending

### User Needs

- Project dashboard with work item counts, completion rates, milestone status
- Work item list with status filtering (open/in-progress/done)
- Documentation session support scoped to project domain
- Relations view showing project → domains → services → events dependencies

## Solutionstatement

### Use Case

- Flow: User opens Project Hub → sees project dashboard → navigates to work items → starts documentation session for undocumented service
- Gherkin:
  ```gherkin
  Given the Project Hub is open for project "IBDE Sprint 5"
  When the user views the dashboard
  Then work item counts are shown (open, in-progress, completed)
  And documentation coverage percentage is displayed
  ```

### Functional Requirements

- [ ] Project Hub opens via command or hub picker, scoped to a project folder
- [ ] Dashboard tab:
  - Work item KPIs (open, in-progress, completed, total)
  - Documentation coverage (documented entities / total entities)
  - Quick actions: New Work Item, Start Session
  - Milestone timeline (if milestones defined)
- [ ] Work Items tab (`table` or `split_dock`):
  - Scanned from project folder (markdown files with work item frontmatter)
  - Columns: name, status, priority, assignee, due date
  - Filter by status
- [ ] Sessions tab:
  - Session history for this project
  - Start new session
- [ ] `ProjectHubAdapter extends HubAdapter`

### Technical Requirements

- Adapter scans project folder for work item files via metadataCache
- Work item status derived from frontmatter `status` field
- Documentation coverage computed by comparing entities mentioned in project scope vs documented entities in docs root
- Project folder path configurable per project

### Constraints

- Work item management is file-based (frontmatter status field), not a custom data store
- No Kanban board in v1 (board layout deferred to v2)
- Project Hub is similar to Product Hub in structure — consider shared `DomainHubAdapter` base

## Acceptance Criteria

- [ ] Project Hub opens scoped to a project folder
- [ ] Dashboard shows work item KPIs and documentation coverage
- [ ] Work items tab lists files with correct status filtering
- [ ] ProjectHubAdapter implements HubAdapter interface
- [ ] All tabs render via Hub framework
- [ ] `npm run build` passes
