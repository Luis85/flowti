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

---

## PRD Addendum: Unified Tool Framework

### Why this is needed

Story Mapping introduces a new category of Flowti UI: **Dedicated Tools** (not just tabs with tables). To scale across domains, Flowti needs a framework to host tools consistently.

---

# Feature PRD: Unified Tool Framework

## 1. Problem Statement

Flowti currently provides Hubs and Views, but dedicated tools (like Story Mapping) require a more advanced environment:

- consistent layout (board + inspector + side panels)
    
- persistent tool state
    
- context binding (domain, entity, PRD, project)
    
- a unified way to register, open, and render tools
    
- standardized docking and keyboard commands
    

Without a tool framework, every new tool becomes a bespoke UI implementation with duplicated patterns and inconsistent UX.

---

## 2. Outcome

After implementation:

- Dedicated tools can be registered via manifest and opened from hubs.
    
- Tools run inside a consistent **Tool Workspace** with docking, inspector, overlays.
    
- Tools receive context via a standard **Tool Context Contract**.
    
- Tool state is persistable (file-based + storage mirror).
    
- New tools can be added with minimal wiring: **manifest + adapter + view component**.
    

---

## 3. Scope

### In Scope (v1)

- Tool Registry (manifest-driven)
    
- Tool Workspace layout (board + dock + inspector)
    
- Tool Context contract (hub/entity/prd/project)
    
- Tool state persistence (load/save)
    
- Entry points from hubs + command palette
    
- Tool lifecycle events (opened/closed/contextChanged)
    

### Out of Scope (v1)

- Multi-user collaboration
    
- Complex plugin marketplace / external tool loading
    
- Tool-to-tool embedding
    

---

## 4. Core Concept

A Tool is a _dedicated workspace_ hosted inside Flowti:

```
Hub → ToolLauncher → ToolWorkspace → ToolView + ToolAdapter
```

Tools are domain-agnostic but context-aware.

---

## 5. Functional Requirements

### 5.1 Tool Registry

-  Tools are defined in a `tools.manifest.md` (or `.json`) and validated.
    
-  A tool has:
    
    - `tool_id`, `name`, `description`
        
    - `supported_contexts` (product, project, domain, user)
        
    - `default_layout` (board+inspector, graph+inspector, etc.)
        
    - `entry_points` (hub actions, tabs, command palette)
        
    - `state_model` reference (where/how to persist)
        

### 5.2 Tool Workspace

-  Unified layout with regions:
    
    - Header (title, breadcrumbs, save/export)
        
    - Main canvas (board/graph/canvas)
        
    - Inspector dock (right)
        
    - Sidebar dock (optional)
        
    - Overlays (modals, command palette)
        
-  Dock supports tool-defined panels.
    
-  Workspace can be embedded as a Hub tab OR opened as full-screen focus mode.
    

### 5.3 Tool Context Contract

-  Tool receives a standard context object:
    
    - active hub
        
    - selected PRD
        
    - selected entity/project
        
    - domain id
        
    - user id
        
-  Tool can request context updates via events only.
    

### 5.4 Tool State Persistence

-  Tool state can be saved to Markdown (canonical)
    
-  Tool state can be mirrored in storage for fast load
    
-  State is deterministic (ordering preserved)
    
-  Supports autosave toggle (optional)
    

### 5.5 Tool Lifecycle Events

Emitted:

- `tool.opened`
    
- `tool.closed`
    
- `tool.context.changed`
    
- `tool.state.saved`
    
- `tool.state.loaded`
    

---

## 6. UI Composition

### 6.1 ToolWorkspace Layout

```
ToolWorkspaceView
├─ ToolHeaderRegion
│  ├─ ToolTitle
│  ├─ Breadcrumbs (Hub → PRD → Tool)
│  ├─ Save / Export / Settings
│  └─ ContextBadge (domain/project)
│
├─ ToolMainRegion
│  └─ ToolCanvasSlot (board/graph/editor)
│
├─ ToolDockRegion
│  ├─ InspectorPanelSlot
│  ├─ ToolPanelsSlot*
│  └─ ContextPanelSlot (optional)
│
└─ ToolOverlayRegion
   ├─ ModalHost
   ├─ CommandPalette
   └─ ToastHost
```

### 6.2 Tool View Slotting

A tool provides:

- `ToolCanvasComponent`
    
- `InspectorComponent`
    
- optional `DockPanels[]`
    

---

## 7. Adapter Contract

```ts
interface ToolAdapter<TState, TContext> {
  tool_id: string;

  // lifecycle
  open(context: TContext): Promise<void>;
  close(): Promise<void>;
  setContext(context: TContext): Promise<void>;

  // state
  loadState(ref?: { path?: string; id?: string }): Promise<TState>;
  saveState(state: TState): Promise<void>;

  // domain actions
  handle(action: ToolAction): Promise<void>;

  // validation
  validateState(state: TState): ValidationResult;
}
```

Tool actions are event-driven:

- UI emits `tool.action.requested`
    
- adapter emits `tool.action.completed` / `tool.action.failed`
    

---

## 8. Manifest Spec (Minimal)

```yaml
tools:
  - tool_id: story_map
    name: User Story Map
    description: Build a story map, slice releases, generate increments.
    supported_contexts: [product, prd, project]
    default_layout: tool_workspace_board
    entry_points:
      - hub: product
        action: create_story_map
      - command: "Flowti: Open Story Map"
    persistence:
      canonical: markdown
      folder: "03 - Resources/Story Maps"
      filename_pattern: "{{prd_id}}-story-map.md"
```

---

## 9. Non-Functional Requirements

- Scales to large boards (virtualization)
    
- No full vault scan on open
    
- Event-driven updates only
    
- Strong separation:
    
    - Layout ≠ Tool logic
        
    - Tool UI ≠ Domain logic
        
    - Adapter mediates all operations
        

---

## 10. Acceptance Criteria

-  A tool can be registered via manifest
    
-  Tool appears as action in Product Hub
    
-  Tool opens inside ToolWorkspace with inspector
    
-  Tool receives hub/prd context
    
-  Tool state can be saved/loaded deterministically
    
-  All operations observable through tool events
    

---

## 11. Definition of Done

-  ToolRegistry implemented + validator
    
-  ToolWorkspaceView implemented
    
-  ToolAdapter base + event wiring implemented
    
-  Story Map uses Tool Framework (first tool)
    
-  Documentation updated
    
-  Tests: registry + adapter lifecycle + state persistence
    

---

## How this plugs into the Story Mapping PRD

- StoryMap is a **Tool** hosted by ToolWorkspace
- It registers in ToolRegistry manifest
- It uses ToolAdapter + Tool state persistence

This prevents Story Map from becoming a one-off.

---

## Suggested folder structure for tools

src/ui/tools/  
toolRegistry/  
toolWorkspace/  
storyMap/  
shared/  
docs/tools/  
tools-manifest.md  
tool-workspace.md
