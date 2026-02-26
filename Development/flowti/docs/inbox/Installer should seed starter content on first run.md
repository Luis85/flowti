---
type: Idea
stage: delivered
origin: inbox
domain: installer
description: "Seed minimal reference docs, templates, and an example domain during first-run setup so new users see a living system immediately."
tags:
  - release-blocker
  - RB-4
priority: "2 - high"
rank:
planned_in: "[[Release Preparation Cycle]]"
delivered_in: "[[Cycle 45 - Supplier Manager Onboarding]], [[Cycle 46 - Supplier Manager Onboarding II]]"
related:
  - "[[I want the installer to use a versioned JSON folder config instead of hardcoded paths]]"
  - "[[backlog-refinement-2026-02-20]]"
  - "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
note: "Release blocker RB-4 RESOLVED. Delivered in C45/C46: SeedContentStep (order 30) seeds sample notes, Welcome to Flowti note, 3 supplier session templates (role-conditional), supplier overview CSV with demo data, seedSupplierDashboard() creates 5-tile dashboard. Example domain seeding (events + flow) deferred — current seed focuses on analytics/supplier persona."
---

## Problem

After first-run install, users see 23 empty folders and no content. The knowledge graph is empty, sessions have no templates, and there is no example to learn from. The system provides no value until the user manually creates content.

## Proposed Solution

Add a `SeedContentStep` to the installer pipeline (order 30, after FolderScaffoldStep):

1. **Example domain**: "Getting Started" domain with:
   - 2-3 sample events (e.g., "idea.captured", "domain.created")
   - 1 sample flow connecting them
   - 1 sample actor ("New User")

2. **Session templates**: Seed `03 - Resources/Templates/Session/` with:
   - Daily Session template
   - Domain Design template
   - Retrospective template

3. **Welcome note**: `00 - Inbox/Welcome to Flowti.md` explaining first steps

4. Seed content sourced from `var/config/installer/v1/seed/` — same versioning as folder config

## Acceptance Criteria

- [ ] First-run creates a populated example domain visible in Event Catalog
- [ ] At least 3 session templates are available immediately
- [ ] Welcome note exists in inbox after install
- [ ] Seed content is idempotent (re-running installer skips existing files)
- [ ] `npm run build` passes
