---
type: UseCase
domain: Flowti
stage: done
description: "Save and load import configurations for repeatable CSV-to-notes workflows"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-78"
tags:
  - use-case
  - csv
---

# Reuse Import Configurations

## Summary

A user saves a fully configured import setup (target folder, name column, column mappings, conflict strategy) so that future imports of the same or similarly structured CSV files can be executed without reconfiguring every setting.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file is open in the CSV Action View.
- The user has completed configuring an import at least through the column mapping step.

## Steps

1. **User configures an import** by selecting the target folder, name column, column mappings, and conflict strategy in the import wizard.
2. **User clicks the "Save Config" button** in the wizard toolbar and enters a descriptive name for the configuration (e.g., "Monthly Sales Import").
3. **System persists the configuration** to the `dataExchange` storage key, including all mapping details and the chosen conflict strategy.
4. **User opens a new or updated CSV file** with the same column structure at a later time.
5. **User clicks "Import"** to enter the wizard and then selects "Load Config" from the dropdown menu.
6. **System displays a list of saved configurations** and the user selects the previously saved config by name.
7. **System pre-fills all wizard fields** (target folder, name column, column mappings, conflict strategy) from the loaded configuration.
8. **User reviews the pre-filled settings**, makes any adjustments if needed, and proceeds to preview and execute the import.

## Outcome

The user completes the import without manually reconfiguring each setting. The saved configuration remains available for future use and is also accessible from the Data Exchange Hub's configuration management interface.

## Variations

- **Column mismatch**: If the new CSV has different headers than the saved config expected, the system highlights unmapped columns and lets the user adjust the mapping before proceeding.
- **Delete saved config**: The user can remove a saved configuration from the Load Config dropdown or from the Data Exchange Hub when it is no longer needed.
- **Hub access**: Saved import configs can also be loaded and managed directly from the Data Exchange Hub, independent of any specific CSV file being open.
- **Overwrite existing config**: When saving with a name that already exists, the system prompts the user to confirm overwriting the previous configuration.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-78 in [[Testplan]]
