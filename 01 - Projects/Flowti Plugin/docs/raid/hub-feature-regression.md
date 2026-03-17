---
type: RAID
category: issue
severity: high
status: open
source: increment-review
iteration: 5
date: 2026-03-18
---

# Hub Feature Regression After Sitemap Migration

## Description

When the Plugin's hub views were migrated from domain-specific implementations to the generic `SitemapHubView` pattern, hub-specific interactive features were lost:

- Dashboard card clicks don't navigate to corresponding tabs
- Domain-specific layouts and behaviors are gone (replaced by generic Lit component rendering)
- Hub providers' summary data may not flow through to the new rendering path
- Custom actions, filters, and interactive elements from the original hub implementations are missing

## Impact

Hub views render content but are non-interactive beyond basic tab switching. The dashboards feel static compared to the pre-migration experience.

## Root Cause

The `SitemapHubView` is a generic renderer — it creates Lit custom elements and sets props, but it doesn't wire the rich event-driven interactions that the original domain-specific hub views had (e.g., `EventCatalogView`, `AnalyticsHubView`). Custom events emitted by Lit components (like `navigate-hub`, `open-session`) need explicit listeners in the handler functions.

## Suggested Fix

Audit each handler file's event listeners against the Lit component's emitted events. Missing listeners need to be wired to the correct EventBus emissions or hub navigation calls. This is a handler-by-handler fix, not an architectural change.
