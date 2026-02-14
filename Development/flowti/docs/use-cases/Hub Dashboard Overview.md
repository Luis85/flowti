---
type: UseCase
domain: Flowti
stage: done
description: "View aggregate counts and launch common actions from the Hub Dashboard"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-74"
tags:
  - use-case
  - hub
---

# Hub Dashboard Overview

## Summary

The user views aggregate statistics about their data exchange activity and launches common actions directly from the Hub's Dashboard tab, which serves as the landing page for the Data Exchange Hub.

## Preconditions

- The Data Exchange Hub view is open.
- The Dashboard tab is selected (it is the default tab when opening the hub).

## Steps

1. The user opens the Data Exchange Hub; the **Dashboard** tab is displayed by default.
2. The dashboard renders a stats grid showing aggregate counts: total saved import configurations, total saved export configurations, total pipelines, and total CSV files discovered in the vault.
3. The user reviews the counts to get a quick overview of their data exchange activity and vault content.
4. The user clicks the **New Import** quick-action button; the system opens the Import Modal to begin a new CSV import workflow.
5. Alternatively, the user clicks the **New Export** quick-action button; the system opens the Export Modal to begin a new vault export workflow.
6. The user clicks the **Open CSV** quick-action button to browse and open a CSV file directly from the vault, navigating to the file in Obsidian's editor.
7. The dashboard also displays recent activity (last imports or exports run) so the user can quickly resume or review recent operations.
8. The user navigates to a specific tab (Imports, Exports, Reports, etc.) by clicking the corresponding tab in the tab bar for detailed management.

## Outcome

The user has a clear overview of their data exchange ecosystem at a glance and can launch any common action (import, export, open CSV) with a single click from the dashboard.

## Variations

- **Empty vault**: When no configurations or CSV files exist, the stats grid shows all zeros and the quick-action buttons serve as onboarding entry points with helpful tooltips.
- **Stale counts**: If configurations are added or removed via modals outside the hub, the dashboard refreshes its counts on tab re-selection.
- **Direct navigation**: The user bypasses the dashboard entirely by clicking a specific tab, using the dashboard only when they want a high-level overview.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-74 in [[Testplan and Teststrategy]]
