---
type: Idea
stage: planned
origin: inbox
domain: installer
parent: "[[Installer PRD]]"
pbi: PBI-005
description: "Externalize the installer folder structure to a versioned JSON config file, decoupling structure from code and supporting rapid schema evolution."
tags:
  - release-blocker
  - RB-1
priority: "00 - critical"
rank:
planned_in: "[[Release Preparation Cycle]]"
related:
  - "[[I want to provide a folder-structure as json to the installer]]"
  - "[[backlog-refinement-2026-02-20]]"
  - "[[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]]"
note: "Release blocker RB-1. Moved from Cycle 11 to Cycle 13 per cycle sequence review (Azure DevOps prioritized in Cycle 11). Currently FolderScaffoldStep creates 23 hardcoded PARA folders. As structures and schemas change rapidly, this must be externalized to a JSON config under var/config/installer/ with version folders (v1/, v2/, etc.). Each version defines its folder tree, seed templates, and expected doc types. The installer reads the latest version config on first run. Migration steps handle upgrades between versions."
---

## Problem

The current `FolderScaffoldStep` in the installer creates a fixed set of 23 PARA-based folders. Every time the project's structure evolves (which happens frequently during rapid development), the code must be changed. This is brittle, untestable against different configurations, and blocks release because new users would get a stale structure.

## Proposed Solution

1. **JSON folder config** in `var/config/installer/v1/folders.json`:
   ```json
   {
     "version": "1",
     "folders": [
       { "path": "00 - Inbox", "description": "Incoming items" },
       { "path": "00 - Inbox/inbox", "description": "Unprocessed captures" },
       { "path": "01 - Now", "description": "Active projects and cycles" },
       ...
     ],
     "seedTemplates": [
       { "source": "templates/session/default.md", "target": "03 - Resources/Templates/Session/Default Session.md" }
     ],
     "docTypes": ["EventDoc", "DomainDoc", "FlowDoc"]
   }
   ```

2. **FolderScaffoldStep reads from config** instead of hardcoded array
3. **Version folder convention**: `v1/`, `v2/`, etc. — installer picks latest
4. **Migration steps**: When upgrading from v1 to v2, a migration step handles renames/moves
5. **User override**: Advanced users can provide their own `folders.json` via settings

## Acceptance Criteria

- [ ] Folder structure is defined in a JSON config file, not in TypeScript code
- [ ] Config is versioned (v1, v2, etc.) with latest auto-selected
- [ ] FolderScaffoldStep reads and executes from config
- [ ] Existing tests pass with config-driven approach
- [ ] New test: custom folder config produces correct folder tree
- [ ] `npm run build` passes
