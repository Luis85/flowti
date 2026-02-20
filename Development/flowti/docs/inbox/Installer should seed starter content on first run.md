---
type: idea
stage: planned
origin: inbox
domain: installer
description: "Seed minimal reference docs, templates, and an example domain during first-run setup so new users see a living system immediately."
tags:
  - release-blocker
  - RB-4
priority: "2 - high"
rank:
related:
  - "[[I want the installer to use a versioned JSON folder config instead of hardcoded paths]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Release blocker RB-4. New users currently see empty folders after install. The knowledge graph has no seed data, making the system feel hollow. First-run should create: (1) example domain with 2-3 events and a flow, (2) session templates for daily session and domain design, (3) a welcome note explaining how to get started."
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
