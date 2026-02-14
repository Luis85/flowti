---
type: UseCase
domain: Flowti
stage: done
description: "Document frontmatter properties in the Hub Properties tab to build a data dictionary"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-73"
tags:
  - use-case
  - hub
---

# Build Data Dictionary

## Summary

The user builds a data dictionary by documenting frontmatter properties discovered across the vault, recording each property's purpose, expected values, and related domains through the Hub's Properties tab.

## Preconditions

- The Data Exchange Hub view is open.
- The vault contains notes with frontmatter properties (at least one property must exist for the tab to show entries).
- The metadata cache has indexed the vault's frontmatter.

## Steps

1. The user opens the Data Exchange Hub and selects the **Properties** tab from the tab bar.
2. The master list displays all unique frontmatter properties discovered across the vault, sorted alphabetically, with documented properties marked by a badge.
3. The user selects an undocumented property from the list to open its detail panel.
4. The detail panel shows the property name, the number of notes that use it, and sample values found in the vault.
5. The user fills in the documentation fields: a description of the property's purpose, its expected value type or format, and any related domains or services.
6. The user clicks **Save**; the system persists the documentation to the data dictionary store and updates the master list to show the "documented" badge on that property.
7. The user repeats the process for additional properties, using the search/filter bar in the master list to locate specific property names quickly.

## Outcome

The user has built a data dictionary with documented descriptions for their vault's frontmatter properties. Documented properties are visually distinguished in the master list, making it easy to track documentation coverage.

## Variations

- **Edit existing documentation**: The user selects an already-documented property and updates its description or related domains; the badge remains and the persisted data is overwritten.
- **Filter by undocumented**: The user filters the master list to show only undocumented properties to focus on coverage gaps.
- **Bulk discovery after import**: After running a CSV import that introduces new frontmatter keys, the Properties tab reflects the newly discovered properties on next render.
- **Property used in exports**: The detail panel cross-references which export configurations include the selected property as a column.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-73 in [[Testplan]]
