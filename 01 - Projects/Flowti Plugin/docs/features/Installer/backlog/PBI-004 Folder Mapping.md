---
type: ProductBacklogItem
feature: "[[Installer PRD]]"
stage: discovery
priority: medium
dependencies:
  - "[[PBI-001 First Run Setup]]"
tags:
  - installer
  - adaptability
  - configuration
user_story: "[[I must be able to map Flowti Concept Folders to different folder structures for better adaptability]]"
---

## User Story - Problemspace

As a vault user with an established folder structure, I want to map Flowti's concept folders to my existing folder layout so that I can adopt Flowti without restructuring my entire vault.

### User Pains

- Flowti enforces a fixed PARA folder structure that may conflict with existing vault layouts
- Users with established conventions must choose between restructuring or not using Flowti
- Hardcoded paths throughout the codebase make customization impossible

### User Needs

- JSON-based folder mapping configuration
- Installer wizard allows remapping during first-run
- Settings UI for post-install remapping
- All plugin features use a path resolver, not hardcoded paths

## Solutionstatement

### Functional Requirements

- [ ] Folder mapping configuration: `var/config/folder-mapping.json`
- [ ] Path resolver service: All Flowti code resolves paths through this service
- [ ] Installer wizard: Folder preview with editable paths
- [ ] Settings UI: Remap folders after installation
- [ ] Default mapping: Standard PARA structure as fallback

## Acceptance Criteria

- [ ] Folder mapping stored as JSON config
- [ ] Installer shows folder preview with editable paths
- [ ] All plugin code uses path resolver
- [ ] Settings UI allows remapping
- [ ] npm run build passes

## Related

- PRD: [[Installer PRD]]
- Inbox: [[I must be able to map Flowti Concept Folders to different folder structures for better adaptability]]
