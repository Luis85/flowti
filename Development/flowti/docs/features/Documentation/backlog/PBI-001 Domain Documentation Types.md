---
type: ProductBacklogItem
feature: "[[Documentation PRD]]"
priority: high
stage: draft
userStories:
  - "[[I want to document file extensions in the system]]"
  - "[[I want to document the various interfaces inside my domain]]"
  - "[[I want to document the various props inside my domain]]"
  - "[[I want to document the various types inside my domain]]"
  - "[[As Product Owner, I want to structure my Product Documentation in one place]]"
useCases: []
---

## User Story

As a product owner or developer working with Flowti, I want to document the types, interfaces, props, and file extensions within my domains so that I have structured, discoverable reference material in one place that helps me and my team understand the system's contracts and data shapes.

## Functional Requirements

- [ ] Type documentation: frontmatter schema `type: TypeDoc` with fields for name, domain, description, and shape definition
- [ ] Interface documentation: frontmatter schema `type: InterfaceDoc` with fields for name, domain, methods, and properties
- [ ] Props documentation: frontmatter schema `type: PropsDoc` with fields for name, component, required/optional flags, and type references
- [ ] File extension documentation: frontmatter schema `type: ExtensionDoc` with fields for extension, associated domain, MIME type, and usage notes
- [x] Product documentation: file-driven `type: ProductDoc` with CRUD in the Products tab (partially implemented)
- [x] Structured folder layout under `docsRootPath` for each documentation type
- [ ] Scan and render methods for each new doc type following the existing hybrid pattern (file + catalog)
- [ ] Cross-references between type/interface/props docs and their parent domain docs

## Acceptance Criteria

- [ ] Each documentation type has a defined frontmatter schema and template
- [ ] New doc types appear in the appropriate catalog tab with create/delete actions
- [ ] Cross-references between types, interfaces, and domains resolve correctly
- [ ] Existing Product documentation continues to work unchanged
- [ ] `npm run build` passes
