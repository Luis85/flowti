---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: in-progress
priority: high
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
note: "Links sessions to vault entities (domains, features, products) for scoped work and traceability. Core functionality delivered in PBI-002 Inc 8.5/10."
---

## User Story — Problem Space

As a domain architect, I want to bind my session to a domain, feature, or product so that my work is scoped and artifacts are traceable to their origin.

### User Pains

- Sessions exist in isolation — no connection to the feature or domain being worked on
- Context switching between the session workspace and the related entity docs is manual
- Post-session artifacts have no automatic link back to the business context
- No way to answer "which sessions contributed to this feature?"

### User Needs

- Bind a session to one or more vault entities via a picker
- See bound context in the workspace header at all times
- Navigate to bound entities directly from the workspace
- Context persisted with session state

## Solution Statement

### Functional Requirements

- [x] `SessionContextBinding` type: `{ id, type, label, path, boundAt }`
- [x] Binding types: file, folder (arbitrary vault paths via fuzzy picker)
- [x] Command/state event pairs: `session.context.bind/bound`, `session.context.unbind/unbound`, `session.context.changeType/typeChanged`
- [x] Max 10 bindings per session
- [x] Workspace shows bound context with clickable navigation
- [x] "Add Context" button opens vault file/folder picker (FuzzySuggestModal)
- [x] Context bindings persisted with session state via TypedStorage
- [x] Folder bindings reveal in file explorer (not create notes)
- [x] Type cycling on badge click (file → folder → tag → domain → ...)
- [ ] Activity log uses bound folder paths as default per-session filter (optional enhancement)

### Delivery Status

**Core functionality delivered in PBI-002 Inc 8.5 and Inc 10:**
- Context binding CRUD (bind, unbind, change type): **done**
- Fuzzy vault picker for files and folders: **done**
- Workspace context section with badges and navigation: **done**
- Folder bindings reveal in file explorer: **done** (Inc 10)
- Max 10 bindings enforcement: **done**
- Persistence via TypedStorage: **done**
- Remaining: auto-populate per-session filter from bound folders

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.context.bind` | Session | `[]` |
| `session.context.bound` | Session | `[]` |
| `session.context.unbind` | Session | `[]` |
| `session.context.unbound` | Session | `[]` |
| `session.context.changeType` | Session | `[]` |
| `session.context.typeChanged` | Session | `[]` |

### Acceptance Criteria

- [x] Bind a session to a file or folder via vault picker
- [x] Bound context visible in workspace context section
- [x] Click on file binding opens in adjacent leaf
- [x] Click on folder binding reveals in file explorer
- [x] Unbind context via workspace UI (X button)
- [x] Max 10 bindings enforced
- [x] Bindings persist across pause/resume
- [x] Type cycling works on badge click
- [x] Build passes: tests + tsc + eslint + esbuild
