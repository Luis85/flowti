---
type: UseCase
domain: Flowti
stage: done
description: "Manage saved import configurations from the Hub Imports tab"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-70"
tags:
  - use-case
  - hub
---

# Manage Import Configurations

## Summary

The user manages their saved CSV-to-vault import configurations through the Hub's Imports tab, reviewing settings, editing mappings, and executing imports without leaving the hub.

## Preconditions

- The Data Exchange Hub view is open.
- At least one import configuration has been saved previously (via the Import Modal or the hub itself).
- The vault contains the target folders referenced by saved configurations.

## Steps

1. The user opens the Data Exchange Hub and selects the **Imports** tab from the tab bar.
2. The master list renders all saved import configurations, each showing its name and target folder.
3. The user selects a configuration from the list to open its detail panel.
4. The detail panel displays the configuration's settings: target folder, name column, column mappings, and conflict strategy (skip, update, or overwrite).
5. The user clicks **Edit** to modify the configuration — the detail panel switches to an editable form where column mappings, conflict strategy, and target folder can be changed.
6. The user saves the changes; the system persists the updated configuration and refreshes the master list.
7. The user clicks **Run Import** to execute the configuration immediately; the system processes the CSV file and reports progress inline.
8. Alternatively, the user clicks **Delete** to remove the configuration, confirming via a prompt before the system removes it from storage.

## Outcome

The user has reviewed, edited, duplicated, deleted, or executed an import configuration entirely from the Hub's Imports tab. Changes are persisted to the plugin's storage and reflected immediately in the master list.

## Variations

- **Duplicate configuration**: The user clicks Duplicate to create a copy of the configuration with a new name, then edits the copy independently.
- **Missing source CSV**: If the referenced CSV file no longer exists in the vault, the Run Import button is disabled and a warning badge appears on the configuration entry.
- **Empty list**: When no import configurations exist, the master list shows an empty state with a prompt to create a new import via the Import Modal.
- **Conflict strategy change**: The user switches the conflict strategy from "skip" to "overwrite" before running, causing existing notes to be replaced instead of skipped.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-70 in [[Testplan]]
