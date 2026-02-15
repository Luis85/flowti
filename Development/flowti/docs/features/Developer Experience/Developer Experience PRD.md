---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L0
business_value: 3
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 3
design_cost: 2
test_cost: 2
priority: 2
---

# PRD: Developer Experience

> Architecture reference: [[Developer Experience]]

---

## 1. Problem Statement

Plugin developers working on Flowti need a streamlined local development workflow covering build tooling, distribution, documentation generation, and script execution. Currently these concerns are scattered across ad-hoc scripts and manual processes, leading to inconsistent builds, undocumented APIs, and friction when onboarding contributors.

---

## 2. Outcome

After implementation, developers will have:

- A single `npm run build` pipeline that validates, documents, lints, and bundles the plugin
- BRAT-compatible distribution for beta testing without manual file copying
- Auto-generated TypeDoc API reference integrated into the vault documentation
- Scriptable task execution for common development workflows

---

## 3. Scope

### In Scope
- esbuild bundling configuration and hot-reload support
- BRAT distribution manifest and release workflow
- TypeDoc generation integrated into the build pipeline
- npm script catalogue (build, test, lint, typedoc, dev)
- Developer onboarding documentation

### Out of Scope
- CI/CD pipeline (GitHub Actions) configuration
- Multi-plugin monorepo support
- Plugin marketplace publishing
- IDE-specific extensions or integrations

---

## 4. UX Entry Points

- **CLI**: `npm run build`, `npm test`, `npm run dev`
- **Vault**: Generated TypeDoc output viewable as markdown in the documentation folder
- **BRAT**: Plugin installable via Obsidian BRAT plugin using repository URL
- **Command Palette**: `Flowti: Open API Docs` (future)

---

## 5. Functional Requirements

- [ ] `npm run build` executes full pipeline: vitest, typedoc, tsc, eslint, esbuild
- [ ] `npm run dev` starts esbuild in watch mode with hot-reload
- [ ] BRAT manifest (`manifest.json`, `versions.json`) generated on release
- [ ] TypeDoc generates API reference from TSDoc comments
- [ ] Script runner supports custom task definitions
- [ ] Build output is placed in `.obsidian/plugins/flowti-ibde/`
- [ ] Error reporting is clear and actionable on build failure

---

## 6. Data Model Impact

No domain data model changes. Build configuration lives in:

- `esbuild.config.mjs` — bundler config
- `tsconfig.json` — TypeScript config
- `typedoc.json` — documentation generator config
- `package.json` — script definitions

---

## 7. Event Impact

**Produced**: None (build-time tooling, not runtime)

**Consumed**: None

---

## 8. UI Layout Impact

Minimal. TypeDoc output rendered as static markdown files within the vault documentation tree. No runtime UI components required for v1.

---

## 9. Adapter Impact

No adapter changes. Build tooling operates outside the plugin runtime. Future: a `DevToolsAdapter` could surface build status in a dashboard.

---

## 10. Non-Functional Requirements

- Build must complete in under 30 seconds for incremental changes
- Watch mode must detect changes within 1 second
- TypeDoc output must be valid markdown readable by Obsidian
- BRAT distribution must work without manual file manipulation
- Must work on Windows, macOS, and Linux

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| esbuild version drift breaks builds | Pin esbuild version, test upgrades |
| TypeDoc output too large for vault | Scope to public API only |
| BRAT manifest out of sync | Automate manifest generation in release script |
| Windows path issues | Use forward slashes, test on Windows CI |

---

## 12. Acceptance Criteria

- [ ] `npm run build` succeeds with zero errors on clean checkout
- [ ] `npm test` runs all test suites and reports results
- [ ] TypeDoc generates browsable API docs in the vault
- [ ] BRAT installation works from repository URL
- [ ] Hot-reload updates plugin on file save during development
- [ ] Build output is correctly placed in plugin directory

---

## 13. Definition of Done

- [ ] All npm scripts documented in README
- [ ] Build pipeline runs vitest, typedoc, tsc, eslint, esbuild in order
- [ ] BRAT distribution tested end-to-end
- [ ] TypeDoc output integrated into vault documentation
- [ ] Developer onboarding guide written
- [ ] CI smoke test validates build on PR (future)
