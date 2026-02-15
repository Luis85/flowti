---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
description: Semantic map of domains, events, flows, systems, actors, and products
type: View
viewType: flowti-event-catalog
extends: ItemView
source: "[[Development/flowti/src/ui/EventCatalogView.ts|EventCatalogView.ts]]"
feature: "[[Event Catalog]]"
parent: "[[User Hub View]]"
---

# Event Catalog View

## Description

The Event Catalog is the primary navigation and management hub for everything that can happen in the system. It presents a master-detail layout with a tab bar across 8 sections: **Dashboard**, **Domains**, **Services**, **Events**, **Flows**, **Systems**, **Actors**, and **Products**.

The left panel provides a searchable, filterable list for the active tab. The right panel shows full detail for the selected item, including metadata, quick actions, subscriptions, event definitions, and cross-references to related entities.

All entity tabs (Domains, Services, Flows, Systems, Actors, Products) are file-driven: they scan Markdown files with typed frontmatter from the documentation root path and merge catalog-derived data for a hybrid view.

## Use Cases

### Browse and discover domain events
Open the Events tab to see all registered events grouped by category. Use the search bar and filter chips to narrow down to a specific domain or tag. Select an event to inspect its description, payload shape, and related documentation.

### Document a business domain
Switch to the Domains tab and click "+" to create a new domain document. Fill in the frontmatter with services, categories, and events. The catalog automatically resolves cross-references and shows related entries.

### Configure event subscriptions and definitions
Click the settings icon on any event to open the Event Config Modal. From there, create subscriptions (file-pattern watchers) or event definitions (ingestion-to-domain mappings) without leaving the catalog.

### Model a business flow
Use the Flows tab to create step-by-step flow documents that reference specific events. The catalog resolves each event against the registry and displays related domains and services.

### Map systems and actors
The Systems and Actors tabs let you document external systems and user personas, linking them to the domains and services they interact with. Cross-reference sections show related flows and events automatically.

### Track products
The Products tab provides a registry of product documents linked to domains, services, and events. Use the dashboard for a quick overview of product counts and quick-create actions.

### Dashboard overview
The Dashboard tab shows aggregate stats (event count, domain count, subscription count, definition count) and provides quick-action buttons for common tasks like creating a new flow, opening the activity log, or managing subscriptions.
