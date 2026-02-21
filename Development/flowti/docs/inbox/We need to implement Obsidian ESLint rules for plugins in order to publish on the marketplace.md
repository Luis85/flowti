---
type: idea
stage: planned
origin: inbox
domain: developer-experience
description: "Implement Obsidian-specific ESLint rules required for community plugin marketplace submission."
tags:
  - release-blocker
  - RB-2
  - developer-experience
  - publishing
priority: "01 - critical"
planned_in: "[[Release Preparation Cycle]]"
parent: "[[Release Preparation PRD]]"
---

## Problem

The Obsidian community plugin review process requires specific code patterns and disallows certain APIs. Without the proper ESLint rules in place, the plugin review will fail and publication will be blocked.

## Proposed Solution

1. Add `eslint-plugin-obsidian` or equivalent Obsidian-specific ESLint rules
2. Configure rules per Obsidian Developer Policies (https://docs.obsidian.md/Developer+policies)
3. Fix all violations across the codebase
4. Integrate into `npm run check` pipeline

## Acceptance Criteria

- [ ] Obsidian ESLint plugin configured
- [ ] All Obsidian developer policy rules pass
- [ ] No forbidden API usage (e.g., `innerHTML` without sanitization)
- [ ] ESLint runs as part of `npm run check` and `npm test`
- [ ] npm run build passes
