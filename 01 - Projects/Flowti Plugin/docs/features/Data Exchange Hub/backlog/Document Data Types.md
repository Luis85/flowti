---
type: UseCase
domain: Flowti
stage: done
description: "Document note types and record schemas in the Hub Types tab"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: ""
tags:
  - use-case
  - hub
---

# Document Data Types

## Summary

The user documents the various data types (note types, record schemas) used across their import and export configurations through the Hub's Types tab, creating a central registry of the vault's structural vocabulary.

## Preconditions

- The Data Exchange Hub view is open.
- The vault uses typed notes (e.g., frontmatter `type` field) in import or export workflows.

## Steps

1. The user opens the Data Exchange Hub and selects the **Types** tab from the tab bar.
2. The master list displays all registered data types, showing each type's name and whether it has been documented.
3. The user clicks the **+** button to register a new data type in the registry.
4. The detail panel opens in edit mode; the user enters the type name, a description of its purpose, and the expected frontmatter schema (required and optional fields).
5. The user links the type to related import or export configurations that produce or consume notes of this type.
6. The user saves the type definition; the system persists it to storage and the master list updates with the new entry showing a "documented" badge.
7. The user selects an existing type from the list to review its schema, see which configurations reference it, and edit its documentation as the schema evolves.

## Outcome

The user has built a registry of data types that describes the structural schemas used across the vault's import and export workflows. Each type entry serves as living documentation of the note structure it represents.

## Variations

- **Auto-discovered types**: The system detects `type` values from vault frontmatter and lists them as undocumented entries, prompting the user to add descriptions.
- **Schema mismatch warning**: When an import configuration produces notes that lack fields defined in the type's schema, the detail panel highlights the discrepancy.
- **Delete type**: The user removes a type definition from the registry; configurations referencing it are not affected but lose the cross-reference link.
- **Type used in multiple configs**: The detail panel lists all import and export configurations that reference the selected type, providing a cross-cutting view of how the type flows through the system.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: N/A
