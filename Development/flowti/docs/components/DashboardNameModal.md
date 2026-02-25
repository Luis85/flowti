---
type: Component
domain: Flowti
stage: done
description: "Modal dialog for creating or editing dashboard names and descriptions"
source: "[[Development/flowti/src/ui/analytics/DashboardNameModal.ts|DashboardNameModal.ts]]"
parent: "[[DashboardsTab]]"
tags:
  - analytics
  - dashboard
  - modal
  - component
---

# DashboardNameModal

## Description

DashboardNameModal is a simple modal dialog for entering or editing a dashboard name and optional description. Used when creating a new dashboard or renaming an existing one. Extends Obsidian's Modal class. Validates that the name is non-empty before confirming.

## Related

- Parent: [[DashboardsTab]]
- Introduced: [[Cycle 29 - Analytics Supplier Manager]] (PBI-ANA-018)
