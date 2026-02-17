---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
note: "Links sessions to vault entities (domains, features, products) for scoped work and traceability."
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

- [ ] `SessionContextBinding` type: `{ type, label, path, boundAt }`
- [ ] Binding types: domain, feature, product, arbitrary vault path
- [ ] Command/state event pairs: `session.context.bind/bound`, `session.context.unbind/unbound`
- [ ] Max 10 bindings per session
- [ ] Workspace header shows bound context badges with clickable navigation
- [ ] "Add Context" button opens vault file/folder picker
- [ ] Context bindings persisted with session state via TypedStorage
- [ ] Activity log can optionally use bound paths as default per-session filter

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.context.bind` | Session | `[]` |
| `session.context.bound` | Session | `[]` |
| `session.context.unbind` | Session | `[]` |
| `session.context.unbound` | Session | `[]` |

### Acceptance Criteria

- [ ] Bind a session to a domain doc via vault file picker
- [ ] Bound context visible in workspace header
- [ ] Click on context badge navigates to the entity
- [ ] Unbind context via workspace UI
- [ ] Max 10 bindings enforced
- [ ] Bindings persist across pause/resume
- [ ] Build passes: tests + tsc + eslint + esbuild
