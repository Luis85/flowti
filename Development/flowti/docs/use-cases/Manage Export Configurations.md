---
type: UseCase
domain: Flowti
stage: done
description: "Manage saved export configurations from the Hub Exports tab"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-72"
tags:
  - use-case
  - hub
---

# Manage Export Configurations

## Summary

The user manages their saved vault-to-CSV/Tab export configurations through the Hub's Exports tab, reviewing source paths, adjusting output settings, and executing exports directly from the detail panel.

## Preconditions

- The Data Exchange Hub view is open.
- At least one export configuration has been saved previously (via the Export Modal or the hub itself).
- The source paths (folders or `.base` files) referenced by saved configurations exist in the vault.

## Steps

1. The user opens the Data Exchange Hub and selects the **Exports** tab from the tab bar.
2. The master list renders all saved export configurations, each displaying its name, source type, and output format (CSV or Tab).
3. The user selects a configuration to open its detail panel.
4. The detail panel shows the full configuration: source path, source type (folder or `.base` view), format, output path, selected columns, file properties, and conflict strategy (overwrite, skip, or append).
5. The user clicks **Edit** to modify settings such as output path, selected columns, or conflict strategy; the detail panel switches to an editable form.
6. After editing, the user saves; the system persists the updated configuration and refreshes the detail view with the new values.
7. The user clicks **Run Export** to execute the configuration; the system scans the source, resolves columns, generates the output file, and displays a completion summary.
8. The user clicks **Open Source** to navigate directly to the source folder or `.base` file in the vault's file explorer.

## Outcome

The user has reviewed, edited, or executed an export configuration from the Hub's Exports tab. The exported file is written to the configured output path, and the configuration changes are persisted to storage.

## Variations

- **External filesystem export**: If the configuration has `isExternal` enabled, the Run Export action writes the file to the local filesystem outside the vault using the Electron save dialog.
- **Append mode**: When conflict strategy is set to "append", the system reads the existing output file, strips the header from the new content, and concatenates it to the end.
- **Source deleted**: If the source path no longer exists, the Run Export button is disabled and a warning is shown in the detail panel.
- **Column changes**: The user adds or removes columns from the export; the system re-scans available properties and updates the preview accordingly.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-72 in [[Testplan and Teststrategy]]
