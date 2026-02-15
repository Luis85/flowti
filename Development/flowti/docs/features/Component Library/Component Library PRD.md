---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L1
---

# PRD: Component Library

> Architecture reference: [[Component Library]]

---

## 1. Problem Statement

Flowti's UI is built from plain-class components following a shared pattern (`constructor(el, deps)`, `renderMaster()`, `renderDetail()`), but there is no centralized catalogue, documentation, or reuse strategy. The existing `ComponentShowcaseView` is outdated (TD-38). Developers duplicate UI patterns across the Event Catalog, Data Exchange Hub, CSV Import, and Export views, leading to visual inconsistencies and wasted effort.

---

## 2. Outcome

After implementation, the team will have:

- A documented, browsable catalogue of reusable Flowti UI components
- Consistent look-and-feel across all plugin views
- Reduced duplication through shared component abstractions
- A living showcase view that stays in sync with the actual component inventory

---

## 3. Scope

### In Scope
- Inventory and document existing shared UI components
- Extract common patterns into reusable component classes
- Update `ComponentShowcaseView` to reflect current components (resolve TD-38)
- Component catalogue with usage examples and props documentation
- Consistent styling tokens (CSS variables) across all components

### Out of Scope
- Full design system with Figma integration
- Web component / custom element implementation
- Storybook or external component explorer
- Theme customization beyond light/dark
- Third-party component framework adoption

---

## 4. UX Entry Points

- **Command Palette**: `Flowti: Open Component Showcase`
- **Developer Menu**: link to component showcase view
- **Documentation**: component catalogue in vault docs folder

---

## 5. Functional Requirements

- [ ] Audit all existing UI components across catalog, hub, csv, and export modules
- [ ] Extract shared patterns into `src/ui/components/` (buttons, cards, tables, modals, forms)
- [ ] Each component has a consistent API: `constructor(el, deps)`, `render()`, `destroy()`
- [ ] Update `ComponentShowcaseView` to display all registered components with live examples
- [ ] Provide usage snippets for each component in the showcase
- [ ] CSS variables defined for spacing, colors, typography, borders
- [ ] Components support both light and dark themes via CSS variables

---

## 6. Data Model Impact

No domain data model changes. Component metadata (name, description, props, category) is code-level only, maintained as JSDoc/TSDoc comments and optionally as a static registry.

---

## 7. Event Impact

**Produced**: None (UI infrastructure, not domain logic)

**Consumed**: None

---

## 8. UI Layout Impact

- `ComponentShowcaseView`: full refresh to display current component inventory
- Existing views (EventCatalog, DataExchangeHub, ImportModal, ExportModal): refactored to use shared components
- New directory: `src/ui/components/` for shared component classes

---

## 9. Adapter Impact

No adapter changes. Components are pure UI building blocks consumed by existing view orchestrators.

---

## 10. Non-Functional Requirements

- Components must have zero external dependencies (Obsidian API only)
- Rendering must be synchronous and DOM-efficient (no virtual DOM)
- Must follow existing plain-class pattern (no framework adoption)
- Showcase must auto-discover registered components (no manual list maintenance)
- CSS must not leak outside component scope

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Refactoring breaks existing views | Incremental extraction; test each view after migration |
| Showcase becomes outdated again | Auto-discovery from component registry |
| Over-abstraction | Start with most-duplicated patterns only |
| CSS conflicts | Scoped CSS variables with `flowti-` prefix |

---

## 12. Acceptance Criteria

- [ ] All shared UI patterns identified and documented
- [ ] At least 5 core components extracted (button, card, table, form group, modal page)
- [ ] `ComponentShowcaseView` displays all components with live examples
- [ ] Existing views refactored to use shared components (at least Event Catalog + Data Exchange Hub)
- [ ] CSS variables defined and used consistently
- [ ] TD-38 resolved

---

## 13. Definition of Done

- [ ] `src/ui/components/` directory populated with extracted components
- [ ] `ComponentShowcaseView` updated and functional
- [ ] At least 2 existing views migrated to shared components
- [ ] Component usage documented (TSDoc + showcase examples)
- [ ] Visual regression check across all plugin views
- [ ] Tests for component rendering and lifecycle
