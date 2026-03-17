# UC-38: Status Bar Display

**Feature:** [User Interface](../features/feature-09-ui.md)

> As a user, I want to see at a glance how many files are being watched and how many have been processed.

## Scenario 38.1: Normal mode shows stats ⏭️

*Requires StatusBarService + DOM*

```gherkin
Given 2 watchers are active watching 5000 files
  And 150 files have been processed, 300 skipped, 2 errors
Then the status bar should display sync counts in compact format
```

## Scenario 38.2: Clicking status bar opens dashboard ⏭️

*Requires DOM event handling*

```gherkin
Given the status bar is visible
When the user clicks the status bar item
Then the dashboard modal should open
```
