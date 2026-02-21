---
type: ProductBacklogItem
feature: "[[Release Preparation PRD]]"
stage: planned
priority: critical
tags:
  - release-blocker
  - RB-1
  - publishing
planned_in: "[[Cycle 13 - Release Preparation]]"
user_story: "[[We need to have the proper file and folder structure in place before publishing]]"
---

## User Story - Problemspace

As a plugin developer, I need the repository structured with meta-files at root so that GitHub, npm, and the Obsidian marketplace can correctly detect, build, and publish the plugin.

### User Pains

- Plugin source in `Development/flowti/` prevents automated tooling from detecting the project
- Cannot configure GitHub Actions CI/CD without root-level `package.json`
- Obsidian community plugin submission requires specific file layout
- Contributors cannot `npm install` without navigating to a subfolder

### User Needs

- Standard repository structure with meta-files at root
- Build pipeline works from repository root
- All existing functionality preserved after restructure

## Solutionstatement

### Functional Requirements

- [ ] Move to root: `package.json`, `manifest.json`, `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `typedoc.json`
- [ ] Move `src/` and `tests/` to repository root
- [ ] Update all relative imports and build paths
- [ ] Keep documentation vault structure intact (adapt references)
- [ ] `npm install && npm test && npm run build` works from root
- [ ] All 2,794+ tests pass after restructure

## Acceptance Criteria

- [ ] `package.json` at repository root
- [ ] `npm install` works from root
- [ ] `npm test` passes all tests
- [ ] `npm run build` produces `main.js`, `manifest.json`, `styles.css`
- [ ] No broken imports or paths

## Related

- PRD: [[Release Preparation PRD]]
- Inbox: [[We need to have the proper file and folder structure in place before publishing]]
