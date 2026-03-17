# UC-36: Mapping CRUD (Create / Edit / Delete)

**Feature:** [Settings & Configuration](../features/feature-08-settings.md)

> As a user, I want to create, edit, and delete folder mappings through the settings UI.

## Scenario 36.1: Create new mapping ⏭️

*Requires Obsidian Modal + DOM*

```gherkin
Given the settings modal is open in "create" mode
When the user fills in sourceFolder and targetFolder
  And clicks Save
Then a new mapping with a generated UUID should be added to settings
  And the watcher should start for the new mapping
```

## Scenario 36.2: Edit existing mapping ⏭️

*Requires Obsidian Modal + DOM*

```gherkin
Given the settings modal is open in "edit" mode for an existing mapping
When the user changes the debounceDelay from 800 to 1500
  And clicks Save
Then the mapping should be updated in settings
  And the watcher should restart with the new configuration
```

## Scenario 36.3: Delete mapping ⏭️

*Requires Obsidian ConfirmModal + DOM*

```gherkin
Given the settings modal shows a Delete button
When the user clicks Delete and confirms via ConfirmModal
Then the mapping should be removed from settings
  And the watcher for that mapping should be stopped
```

## Scenario 36.4: Validation rejects empty folders ⏭️

*Requires FolderMappingModal.validateMapping*

```gherkin
Given the create modal is open
When the user leaves sourceFolder empty and clicks Save
Then an error notice "Source folder is required" should be shown
  And the mapping should NOT be saved
```
