---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to configure Signal to sync work items from Azure DevOps into your vault as structured notes.
tags:
  - tutorial
  - signal
  - azure-devops
---

# Connecting to Azure DevOps

> The Signal domain connects Flowti to external data sources. This tutorial walks you through configuring a connection to Azure DevOps so your work items sync into your vault as structured notes.

---

## What Is Signal?

Signal is Flowti's way of reaching outside the vault. Instead of manually exporting data from external tools and importing CSV files, Signal maintains a live connection that pulls data directly into your vault.

Currently, Signal supports **Azure DevOps** as a data source. When configured, it fetches work items — user stories, bugs, tasks, features — and creates or updates notes in your vault with all the relevant fields as frontmatter properties.

This means your Azure DevOps backlog becomes part of your living documentation system. You can query it, build dashboards on it (see [[Building Dashboards]]), and connect it to your domains and events.

---

## What You Will Need

Before you start, gather these details from your Azure DevOps environment:

| Item | Where to Find It |
|------|-----------------|
| **Organization URL** | The base URL of your Azure DevOps organization, e.g., `https://dev.azure.com/your-org` |
| **Project name** | The name of the project you want to sync from |
| **Personal Access Token (PAT)** | A token with read access to work items. Generate one from Azure DevOps under User Settings > Personal Access Tokens |

Your PAT is stored securely using Obsidian's built-in secret storage. It never appears in your vault files or plugin settings.

---

## Configuring a Signal Connection

1. Open the **Data Exchange Hub** (search for **Open data exchange hub** in the command palette)
2. Navigate to the **Signals** section
3. Click **+** to add a new signal connection
4. Fill in the configuration:

   - **Name** — a friendly label, e.g., "My Team Backlog" or "Project Alpha Work Items"
   - **Organization URL** — paste your Azure DevOps organization URL
   - **Project** — enter the project name
   - **Personal Access Token** — paste your PAT (it will be stored securely)
   - **Target folder** — choose where synced notes should be created in your vault
   - **Item type filter** — optionally limit which work item types to sync (e.g., only User Stories and Bugs, not Tasks)
   - **Conflict strategy** — what to do when a note for a work item already exists:
     - **Skip** — do not touch existing notes
     - **Update** — merge updated fields into the existing note
     - **Overwrite** — replace the note entirely with fresh data

5. Click **Test Connection** to verify that Flowti can reach your Azure DevOps project with the provided credentials
6. If the test succeeds, save the configuration

---

## Running Your First Sync

Once the connection is configured and tested:

1. Click **Sync** on your signal connection, or open the command palette and search for **Sync all signals**
2. Flowti connects to Azure DevOps, fetches the work items matching your filters, and creates notes in your target folder
3. The sync progress is displayed in real time — you will see how many items are created, updated, or skipped
4. When complete, a summary shows the results: items created, items updated, items skipped, and any errors

Open your target folder and browse the created notes. Each work item becomes a note with structured frontmatter:

- `id` — the Azure DevOps work item ID
- `type` — User Story, Bug, Task, Feature, etc.
- `title` — the work item title
- `state` — the current state (New, Active, Resolved, Closed, etc.)
- `assignedTo` — who the item is assigned to
- `priority` — the priority level
- `areaPath` and `iterationPath` — the area and sprint
- `tags` — any tags from Azure DevOps
- `createdDate` and `changedDate` — timestamps

The note body includes the work item description, so you have the full context right in your vault.

---

## Keeping Data Fresh

Signal connections remember when they last synced. You can run a sync at any time to pull the latest changes from Azure DevOps. Updated work items will refresh their corresponding notes (if your conflict strategy is set to Update or Overwrite).

To sync, use the command palette and search for **Sync all signals**, or click the Sync button on the individual connection in the Data Exchange Hub.

There is no automatic sync schedule yet — you trigger each sync manually when you want fresh data. This gives you full control over when your vault updates.

---

## Querying Your Work Items

Once your work items are in the vault as notes with structured frontmatter, you can use the full power of Flowti's analytics:

- **Build queries** to filter and group work items — see [[Creating Analytics Queries]]
- **Create dashboards** with stat cards showing open bug count, charts showing items by sprint, tables of unassigned work — see [[Building Dashboards]]
- **Connect to domains** — link work items to the domains they belong to, creating a bridge between your external backlog and your internal documentation

This is where the real value emerges. Your Azure DevOps data is no longer locked in a separate tool. It lives alongside your documentation, your events, your domains — all queryable, all connected.

---

## Tips for a Smooth Setup

**Use a dedicated folder.** Create a folder like `Signal/Azure DevOps/` for synced notes. This keeps them separate from hand-written documentation and makes it easy to set up queries that target only work items.

**Start with a type filter.** If your project has thousands of work items, filter to just one or two types for your first sync. Expand later once you are comfortable with the results.

**Use the Update conflict strategy.** This preserves any notes or annotations you add to synced work items by hand while still refreshing the frontmatter with the latest data from Azure DevOps.

**Check the test connection before syncing.** If your PAT has expired or the project name is wrong, the test will catch it before you wait for a sync that will fail.

---

## Next Steps

- [[Building Data Exchange Configs]] — Manage all your data connections in one place
- [[Creating Analytics Queries]] — Query your synced work items
- [[Building Dashboards]] — Visualize your backlog on a dashboard
