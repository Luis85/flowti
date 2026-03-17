---
type: ProductBacklogItem
feature: "[[Release Preparation PRD]]"
stage: done
delivered_in: "[[Cycle 48 - Stabilize and Strategic Spike]]"
priority: critical
tags:
  - release-blocker
  - RB-2
  - publishing
planned_in: "[[Release Preparation Cycle]]"
user_story: "[[We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace]]"
---

## User Story - Problemspace

As a plugin developer, I need Obsidian-specific ESLint rules configured and passing so that the plugin passes the Obsidian community review and can be published on the marketplace.

### User Pains

- Obsidian developer policies require specific code patterns
- Some APIs are forbidden (e.g., unsanitized `innerHTML`)
- Without compliance, plugin review will fail
- No automated enforcement of Obsidian-specific rules in the build pipeline

### User Needs

- Obsidian ESLint rules configured
- All violations fixed across codebase
- Rules integrated into build pipeline

## Solutionstatement

### Functional Requirements

- [x] Add Obsidian-specific ESLint rules per Developer Policies
- [x] Audit codebase for forbidden API usage
- [x] Fix all violations
- [x] Integrate into `npm run check` and `npm test` pipelines
- [x] Document any Obsidian-specific patterns in AGENTS.md

## Acceptance Criteria

- [x] Obsidian ESLint plugin configured in `eslint.config.mjs` (`eslint-plugin-obsidianmd`)
- [x] All developer policy rules pass — 0 errors, 0 warnings
- [x] No forbidden API usage (innerHTML, insertAdjacentHTML, console.log banned)
- [x] `npm run check` includes Obsidian ESLint rules
- [x] npm run build passes

## Related

- PRD: [[Release Preparation PRD]]
- Inbox: [[We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace]]
