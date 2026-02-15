---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: idea
related_events: []
maturity: L0
---

# Feature: Prototype Builder

> Architecture reference: [[Prototype Builder]]

---

## 1. Problem Statement

Product teams working in Obsidian lack a way to rapidly sketch and iterate on product prototypes alongside their documentation. Moving between a knowledge vault and external prototyping tools (Figma, Balsamiq) creates context-switching overhead and breaks the flow of product thinking.

- **Who is affected?** Product managers, designers, and developers who use Obsidian for product documentation.
- **What breaks?** Prototypes live outside the vault, disconnected from requirements, flows, and user stories.
- **Why it matters:** Keeping prototypes in-vault means they are versioned, linked, and discoverable alongside the domain knowledge that informs them.

---

## 2. Outcome

- **User can** create low-fidelity wireframes and interaction flows directly inside Obsidian notes using a visual canvas or structured markdown syntax.
- **System can** render prototype screens, link them to flows and requirements, and export them as shareable artifacts.
- **Domain gains** a prototyping capability that closes the gap between ideation and specification.

---

## 3. Scope

### In Scope (vision)

- Screen/wireframe canvas embedded in notes
- Component library (buttons, inputs, cards, lists, navigation)
- Screen-to-screen navigation links (clickable prototype)
- Linking prototype screens to Flow docs, Actor docs, and Requirements
- Export to static HTML or image for sharing

### Out of Scope

- High-fidelity design (pixel-perfect, typography, colors)
- Animation and micro-interactions
- Code generation from prototypes
- Real-time multiplayer editing of prototypes
- Figma/Sketch import/export

---

## 4. UX Entry Points

- **Code block**: ` ```prototype ` fenced block renders a visual canvas
- **Command palette**: `flowti:new-prototype` creates a PrototypeDoc
- **Products/Flows tab**: "Add Prototype" action on entity detail panels

---

## 5. Functional Requirements

- [ ] Prototype canvas renders inside a fenced code block or dedicated view
- [ ] Drag-and-drop component placement on canvas
- [ ] Component library with basic UI primitives (button, input, text, card, list, nav)
- [ ] Screen linking: click a button/area to navigate to another prototype screen
- [ ] Frontmatter links prototype to flows, actors, and requirements docs
- [ ] Export prototype as static HTML or PNG image
- [ ] Prototype data persisted as structured YAML or JSON within the note

---

## 6. Data Model Impact

Potential entities:

```
PrototypeDoc (frontmatter)
  type: "PrototypeDoc"
  name: string
  screens: string[]          (screen IDs)
  linkedFlows: string[]
  linkedActors: string[]

PrototypeScreen
  screenId: string
  name: string
  components: PrototypeComponent[]
  links: { componentId, targetScreenId }[]

PrototypeComponent
  id: string
  type: "button" | "input" | "text" | "card" | "list" | "nav"
  x: number
  y: number
  width: number
  height: number
  label?: string
  properties?: Record<string, string>
```

---

## 7. Event Impact

### Produced (proposed)

- `prototype.created` — payload: `{ name, filePath }`
- `prototype.screen.added` — payload: `{ prototypeName, screenId }`
- `prototype.exported` — payload: `{ prototypeName, format }`

### Consumed

- `file.created` / `file.modified` — to detect prototype doc changes

---

## 8. UI Layout Impact

- Prototype canvas rendered within note content (code block processor)
- Component palette sidebar when editing a prototype
- No new top-level views required in v1

---

## 9. Adapter Impact

```
PrototypeService (proposed)
├── createPrototype(name): Promise<TFile>
├── addScreen(filePath, screen): Promise<void>
├── updateScreen(filePath, screenId, data): Promise<void>
├── removeScreen(filePath, screenId): Promise<void>
├── exportAsHtml(filePath): Promise<string>
└── exportAsImage(filePath): Promise<Blob>
```

---

## 10. Non-Functional Requirements

- **Responsiveness**: Canvas interactions (drag, resize) must feel instant (< 16ms frame time)
- **Storage**: Prototype data stored as structured text within markdown — no binary blobs
- **Portability**: Exported HTML prototypes work standalone in any browser

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Canvas rendering complexity in Obsidian's DOM | Use SVG or lightweight canvas library within code block |
| Large prototypes bloating note files | Cap components per screen; suggest splitting across notes |
| Obsidian mobile limitations | Desktop-first; mobile gets read-only prototype preview |

---

## 12. Acceptance Criteria

- [ ] User can create a prototype doc with at least one screen
- [ ] Components can be placed and resized on the canvas
- [ ] Clicking a linked component navigates to the target screen
- [ ] Prototype doc links to related Flow and Actor docs via frontmatter
- [ ] Export produces a working standalone HTML file

---

## 13. Definition of Done

- [ ] PrototypeService implemented with CRUD for screens and components
- [ ] Canvas renderer handles component placement and navigation
- [ ] Component library provides at least 5 primitive types
- [ ] Export to HTML implemented and tested
- [ ] Frontmatter linking to flows/actors working
- [ ] Unit tests cover service and renderer
- [ ] `npm run build` passes
