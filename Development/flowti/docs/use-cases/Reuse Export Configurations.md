---
type: UseCase
domain: Flowti
stage: done
description: "Save and reload export configurations for repeated use across sessions"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-87"
tags:
  - use-case
  - export
---

# Reuse Export Configurations

## Summary

A user saves an export configuration after setting it up, then reloads it later to re-run the same export without reconfiguring source, format, columns, and output path from scratch.

## Preconditions

- The Export wizard is open with a fully configured export (source, format, columns, and output path specified).
- The `DataExchangeService` has been initialized and its `load()` method has run (storage is available).

## Steps

1. Configure an export in the Export wizard: select the source path, choose format (CSV or Tab), pick columns, and set the output path.
2. Click the **"Save Config"** button in the wizard toolbar.
3. Enter a descriptive name for the configuration (e.g., "Weekly Project Export") in the prompt dialog and confirm.
4. The `DataExchangeService` persists the configuration as a `SavedExportConfig` under the `dataExchange` storage key, including source path, source type, format, output path, selected columns, and file properties.
5. Close the wizard. Later, open a new Export wizard from the file menu or the Data Exchange Hub.
6. Click the **"Load Config"** dropdown at the top of the wizard and select the previously saved configuration by name.
7. The wizard pre-fills all fields (source path, format, columns, output path, conflict strategy) from the saved config. Adjust any values if needed.
8. Click **Export** to run the export with the loaded configuration.

## Outcome

The export executes with the pre-filled configuration, producing the same output structure as the original saved setup. The saved config remains available for future use and can be managed (loaded or deleted) from the Data Exchange Hub.

## Variations

- **Hub access**: Saved export configs are also listed in the Data Exchange Hub view, where users can load or delete them without opening the Export wizard first.
- **Config update**: Saving a new config with the same name overwrites the previous version.
- **Stale source path**: If the saved source path no longer exists (file deleted or moved), the wizard displays a warning and the user must update the source before exporting.
- **Cross-format change**: A user may load a CSV config and switch the format to Tab (or vice versa) before exporting; the output extension updates accordingly.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-87 in [[Testplan]]
