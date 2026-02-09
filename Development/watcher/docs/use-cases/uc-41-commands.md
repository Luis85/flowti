# UC-41: Commands

**Feature:** [User Interface](../features/feature-09-ui.md)

> As a user, I want to access common plugin actions via the Obsidian command palette.

## Scenario 41.1: Restart watchers command ⏭️

*Requires Obsidian Plugin.addCommand*

```gherkin
Given the user opens the command palette
When they execute "filewatcher-restart"
Then all watchers should stop and restart
```

## Scenario 41.2: Open dashboard command ⏭️

*Requires Obsidian Plugin.addCommand*

```gherkin
Given the user opens the command palette
When they execute "filewatcher-dashboard"
Then the dashboard modal should open
```
