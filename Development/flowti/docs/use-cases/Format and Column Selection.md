---
type: UseCase
domain: Flowti
stage: done
description: "Rename export columns with display name mappings to produce clean, human-readable headers"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-88"
tags:
  - use-case
  - export
---

# Format and Column Selection

## Summary

A user customizes the export output by selecting specific columns, reordering them, and applying display name mappings so that the exported file has clean, human-readable headers without changing the underlying frontmatter property names in the vault.

## Preconditions

- The Export wizard is open with a valid source (base view or folder) that has been scanned for available columns.
- At least two columns are available for selection (to demonstrate reordering and renaming).

## Steps

1. Open the Export wizard from the file navigator context menu or the Data Exchange Hub.
2. After the source is configured, the wizard displays the **column selection** page with all discovered frontmatter properties listed as checkboxes.
3. Check or uncheck columns to control which properties appear in the export output. Deselected columns are excluded entirely.
4. For any column that needs a friendlier header, click the column's **display name** field and type a custom label (e.g., rename `proj_status` to `Project Status`).
5. The preview table updates in real-time to reflect the renamed headers, showing the display names in the header row while the data values remain unchanged.
6. Optionally toggle **file properties** (such as `file.name` or `file.path`) to include them as additional columns with their own display name fields.
7. Review the preview to confirm that headers are correct and data rows align with the renamed columns.
8. Click **Export** to generate the file with the custom column headers.

## Outcome

The exported file contains headers matching the user-specified display names rather than the raw frontmatter property keys. The underlying vault notes are unaffected. The display name mappings are preserved if the configuration is saved for reuse.

## Variations

- **No renaming**: If the user leaves all display name fields empty, the export uses the original frontmatter property names as headers (default behavior).
- **Formula column renaming**: For base view exports, resolved formula columns can also be renamed. The display name overrides the formula reference name in the header.
- **Saved config with mappings**: When a configuration with display name mappings is saved and reloaded, all custom column names are restored in the wizard.
- **Conflicting display names**: If two columns are given the same display name, the export produces duplicate headers. The wizard does not enforce uniqueness, leaving it to the user's discretion.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-88 in [[Testplan]]
