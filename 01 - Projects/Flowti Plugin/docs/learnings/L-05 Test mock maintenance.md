---
type: Learning
id: L-05
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 2
domain: testing
tags:
  - learning
  - testing
  - mocks
---

# L-05: Test mock maintenance

Adding a new field to `UserHubComponentDeps` required updating 3 test files' mock factories. This is a known cost of the deps injection pattern — worth it for testability, but mock factories should stay in sync.

## Pattern

- Every new field added to a `Deps` interface requires updating ALL test files that create mock deps
- Shared mock factories (e.g., `createMockStorage`, `createMockFileSystem`) reduce this cost
- Consider centralizing component deps mock factories in `tests/mocks/`

## When to Apply

- When adding new fields to any component `Deps` interface
- When multiple test files share the same mock structure
