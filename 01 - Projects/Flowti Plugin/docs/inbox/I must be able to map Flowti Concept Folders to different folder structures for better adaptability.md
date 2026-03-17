---
type: Idea
stage: discovery
origin: inbox
domain: installer
description: "Allow users to map Flowti's concept folders (PARA, domains, events, etc.) to custom folder structures for vault adaptability."
tags:
  - installer
  - configuration
  - adaptability
priority: "02 - high"
parent: "[[Installer PRD]]"
---

## Problem

Flowti enforces a fixed PARA folder structure (`00 - Connectivity`, `01 - Projects`, etc.) that may not match existing vault layouts. Users with established folder conventions must either restructure their vault or abandon Flowti. This is a significant adoption barrier.

## Proposed Solution

1. Folder mapping configuration: JSON-based mapping of Flowti concept folders to user-defined paths
2. Installer step: Allow remapping during first-run wizard
3. Settings UI: Remap folders from Settings after installation
4. Resolution layer: All Flowti features use a path resolver that looks up the mapping instead of hardcoded paths

## Acceptance Criteria

- [ ] Folder mapping config stored as JSON (e.g., `var/config/folder-mapping.json`)
- [ ] Installer wizard shows folder preview with editable paths
- [ ] All plugin code uses path resolver, not hardcoded folder names
- [ ] Settings UI allows remapping after installation
- [ ] npm run build passes
