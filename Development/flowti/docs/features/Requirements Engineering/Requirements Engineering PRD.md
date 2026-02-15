---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: idea
related_events: []
maturity: L0
---

# Feature: Requirements Engineering

> Architecture reference: [[Requirements Engineering]]

---

## 1. Problem Statement

Product and engineering teams using Obsidian for knowledge management have no structured way to capture, trace, and validate requirements within the vault. Requirements end up scattered across notes, disconnected from the features, flows, and tests they govern.

- **Who is affected?** Product managers, business analysts, and engineers who define and track requirements.
- **What breaks?** Requirements lack traceability to implementations and tests, making impact analysis and coverage verification manual and error-prone.
- **Why it matters:** Requirements traceability is essential for regulated environments and complex products. Embedding it in the vault keeps it alongside domain knowledge.

---

## 2. Outcome

- **User can** create, categorize, and prioritize requirements as structured vault notes with standardized frontmatter.
- **System can** trace requirements to features, flows, test cases, and products — surfacing coverage gaps and orphaned requirements.
- **Domain gains** a lightweight requirements management capability that leverages Flowti's event-driven architecture and existing entity linking.

---

## 3. Scope

### In Scope (vision)

- Requirement doc type (`RequirementDoc`) with structured frontmatter
- Requirement categories: functional, non-functional, constraint, assumption
- Traceability links: requirement to feature, flow, test case, product
- Requirements tab in the Event Catalog or a dedicated hub
- Coverage matrix: requirements vs. linked entities
- Status tracking: draft, approved, implemented, verified, deprecated

### Out of Scope

- Formal requirement specification languages (SysML, DOORS export)
- Automated requirement extraction from natural language
- Approval workflows with signatures
- Version diffing of individual requirements

---

## 4. UX Entry Points

- **Event Catalog / Hub**: Requirements tab showing master-detail list
- **Command palette**: `flowti:new-requirement` creates a RequirementDoc
- **Entity detail panels**: "Linked Requirements" section on flows, features, and test cases

---

## 5. Functional Requirements

- [ ] RequirementDoc frontmatter schema with `type`, `category`, `priority`, `status`, `linkedFeatures`, `linkedFlows`, `linkedTests`
- [ ] Requirements tab with master list (filterable by category, status, priority)
- [ ] Detail panel showing requirement text, traceability links, and status
- [ ] Coverage matrix view: requirements vs. features/flows/tests
- [ ] Orphan detection: requirements not linked to any feature or test
- [ ] CRUD via file creation/deletion following existing doc patterns
- [ ] Bulk status update for requirement sets

---

## 6. Data Model Impact

Potential entities:

```
RequirementDoc (frontmatter)
  type: "RequirementDoc"
  name: string
  category: "functional" | "non-functional" | "constraint" | "assumption"
  priority: "must" | "should" | "could" | "wont"
  status: "draft" | "approved" | "implemented" | "verified" | "deprecated"
  linkedFeatures: string[]
  linkedFlows: string[]
  linkedTests: string[]
  linkedProducts: string[]
```

Stored as markdown files in `docsRootPath/Requirements/`.

---

## 7. Event Impact

### Produced (proposed)

- `requirement.created` — payload: `{ name, category, filePath }`
- `requirement.updated` — payload: `{ name, changes }`
- `requirement.statusChanged` — payload: `{ name, oldStatus, newStatus }`
- `requirement.deleted` — payload: `{ name, filePath }`

### Consumed

- `file.created` / `file.modified` / `file.deleted` — to detect requirement doc changes

---

## 8. UI Layout Impact

- New "Requirements" tab in Event Catalog or dedicated Hub
- Split-dock layout: master list + detail panel (consistent with Flows, Systems tabs)
- Coverage matrix as a separate sub-tab or modal

---

## 9. Adapter Impact

```
RequirementService (proposed)
├── scanRequirements(): RequirementEntry[]
├── createRequirement(name, category): Promise<TFile>
├── deleteRequirement(filePath): Promise<void>
├── getTraceabilityMatrix(): TraceabilityRow[]
├── findOrphaned(): RequirementEntry[]
└── updateStatus(filePath, status): Promise<void>
```

---

## 10. Non-Functional Requirements

- **Scalability**: Handle 500+ requirements without UI lag (virtualized list)
- **Traceability**: Bidirectional links resolvable from both requirement and linked entity
- **Consistency**: Frontmatter auto-normalized on scan (same pattern as domains/services)

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Requirements bloat making vault unwieldy | Folder structure and status filters keep views manageable |
| Traceability links going stale | Health checks detect broken links (extend existing reference integrity check) |
| Overlap with existing Flow/Feature docs | Clear separation: requirements state "what" must be true; flows state "how" it happens |

---

## 12. Acceptance Criteria

- [ ] User can create a RequirementDoc with category, priority, and status
- [ ] Requirements tab shows filterable master list
- [ ] Detail panel displays requirement text and traceability links
- [ ] Coverage matrix shows which requirements are linked to features/tests
- [ ] Orphaned requirements are detectable
- [ ] CRUD operations create/delete markdown files

---

## 13. Definition of Done

- [ ] RequirementDoc schema defined and documented
- [ ] RequirementService with scan, CRUD, and traceability methods
- [ ] Requirements tab implemented with master-detail layout
- [ ] Coverage matrix view implemented
- [ ] Health check extended for requirement reference integrity
- [ ] Unit tests cover service and scan logic
- [ ] `npm run build` passes
