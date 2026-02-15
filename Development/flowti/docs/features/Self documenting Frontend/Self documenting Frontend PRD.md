---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L0
---

# PRD: Self-Documenting Frontend

> Architecture reference: [[Self documenting Frontend]]

---

## 1. Problem Statement

Flowti's frontend components, views, and their relationships are documented manually and inconsistently. Developers must read source code to understand component hierarchies, available props, and rendering lifecycles. The TypeDoc output covers API signatures but does not capture UI component structure, state flows, or visual composition. There is no way for the frontend to describe itself to users or developers at runtime.

---

## 2. Outcome

After implementation:

- The plugin frontend can generate and display its own component documentation at runtime
- Developers see live component trees, state descriptions, and event wiring
- TypeDoc API docs are supplemented with component-level documentation
- New contributors onboard faster by browsing the self-documenting UI

---

## 3. Scope

### In Scope
- Runtime component introspection (list registered components, their hierarchy, and state)
- Self-documentation view accessible from within the plugin
- Integration with TypeDoc output for API-level detail
- Component metadata annotations (description, props, events, dependencies)
- Auto-generated component relationship diagram (text-based)

### Out of Scope
- Visual component screenshot capture
- External documentation site generation
- Source map integration or debugging tools
- Performance profiling or runtime metrics
- AI-generated documentation

---

## 4. UX Entry Points

- **Command Palette**: `Flowti: Open Frontend Documentation`
- **Component Showcase**: "View Source Docs" link per component
- **Developer Menu**: "Frontend Architecture" section
- **Settings**: Toggle to enable/disable self-documentation features

---

## 5. Functional Requirements

- [ ] Components can declare metadata (name, description, props, events) via decorators or static fields
- [ ] Runtime registry collects all registered component metadata
- [ ] Self-documentation view renders component tree with metadata
- [ ] Each component entry shows: description, props, consumed/produced events, parent/child relationships
- [ ] TypeDoc output linked from component entries where available
- [ ] Component relationship diagram generated as text (Mermaid or ASCII)
- [ ] Documentation refreshes on plugin reload

---

## 6. Data Model Impact

No persisted data model changes. Component metadata is runtime-only:

```
ComponentMeta
  name, description, category
  props: { name, type, default, description }[]
  events: { name, direction (in|out), description }[]
  children: string[]
  parent: string | null
```

---

## 7. Event Impact

**Produced**: `frontend.docs.refreshed` (when documentation view regenerates)

**Consumed**: `plugin.loaded` (to trigger initial metadata collection)

---

## 8. UI Layout Impact

- New view: `FrontendDocsView` — master-detail layout showing component tree (master) and component detail (detail)
- Integration point in `ComponentShowcaseView` as a "Docs" tab
- No changes to existing functional views

---

## 9. Adapter Impact

- New: `ComponentRegistryService` — collects and serves component metadata
- Methods: `register(meta)`, `getAll()`, `getByName(name)`, `getTree()`
- No domain adapter changes

---

## 10. Non-Functional Requirements

- Metadata collection must not impact plugin startup time (lazy collection)
- Self-documentation view must render in under 500ms
- Must work without network access
- Must not increase bundle size by more than 5KB
- Annotations must be optional (components without metadata still function)

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Metadata goes stale | Derive from runtime registration, not manual docs |
| Performance overhead | Lazy collection; only build on view open |
| Developer adoption of annotations | Start with existing components; make annotation minimal |
| Overlap with Component Library | Position as developer docs, not UI reuse |

---

## 12. Acceptance Criteria

- [ ] At least 10 components have metadata annotations
- [ ] Self-documentation view renders component tree correctly
- [ ] Component detail shows props, events, and relationships
- [ ] TypeDoc links resolve to correct API entries
- [ ] Component diagram is generated and readable
- [ ] View accessible from Command Palette

---

## 13. Definition of Done

- [ ] `ComponentRegistryService` implemented
- [ ] Metadata annotation pattern documented and applied to core components
- [ ] `FrontendDocsView` implemented with master-detail layout
- [ ] TypeDoc integration working
- [ ] Component relationship diagram rendering
- [ ] Documentation for this feature added
- [ ] Tests for registry service and metadata collection
