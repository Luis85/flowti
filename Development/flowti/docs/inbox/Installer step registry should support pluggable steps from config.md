---
type: idea
stage: discovery
origin: inbox
domain: installer
description: "Formalize the installer step registry so custom and community steps can be loaded from configuration."
tags: []
priority: "01 - medium"
rank:
related:
  - "[[I want the installer to use a versioned JSON folder config instead of hardcoded paths]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "InstallerService already supports registerStep(). This formalizes the pattern so steps can be declared in config and loaded dynamically."
---

## Problem

InstallerService has `registerStep()` but steps are registered programmatically in `main.ts`. There is no way for users or future extensions to add installer steps without modifying source code.

## Proposed Solution

Define installer steps in `var/config/installer/v1/steps.json`:
```json
{
  "steps": [
    { "id": "user-creation", "order": 10, "builtin": true },
    { "id": "folder-scaffold", "order": 20, "builtin": true },
    { "id": "seed-content", "order": 30, "builtin": true }
  ]
}
```

Future: allow custom steps via a step plugin interface.
