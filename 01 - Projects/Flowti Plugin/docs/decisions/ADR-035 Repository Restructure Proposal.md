---
type: ArchitectureDecisionRecord
status: proposed
date: 2026-02-22
deciders:
  - Product Owner
  - Technical Architect
context: "[[Cycle 16 - Improvement Sprint]]"
release_blocker: RB-1
tags:
  - architecture
  - release
  - repository
---

# ADR-035: Repository Restructure Proposal

## Status

**Proposed** — analysis complete, decision pending.

## Context

The Flowti plugin source code lives at `Development/flowti/` inside an Obsidian vault that serves as the git repository root (`c:\Projects\flowti`). The Obsidian Community Plugin marketplace requires `manifest.json` at the repository root and GitHub releases with `main.js` + `manifest.json` as assets. The current structure makes marketplace submission impossible without restructuring.

This ADR documents the analysis, constraints, options, and a recommended migration path for release blocker **RB-1**.

## Current Structure

```
c:\Projects\flowti/                     ← git root = Obsidian vault root
├── .git/
├── .gitignore                          ← excludes vault dirs, .obsidian/plugins
├── .obsidian/
│   └── plugins/flowti-ibde/            ← build output (main.js, manifest.json, styles.css)
├── 00 - Connectivity/                  ← vault content (gitignored)
├── 01 - Projects/                      ← vault content (gitignored)
├── 02 - Areas/                         ← vault content (gitignored)
├── 03 - Resources/                     ← vault content (gitignored)
├── 04 - Archive/                       ← vault content (gitignored)
├── Development/
│   └── flowti/                         ← plugin source root (npm, tsc, esbuild)
│       ├── package.json
│       ├── tsconfig.json
│       ├── esbuild.config.mjs
│       ├── eslint.config.mjs
│       ├── vitest.config.ts
│       ├── manifest.json
│       ├── versions.json
│       ├── styles.css
│       ├── src/                        ← TypeScript source (~230 files)
│       ├── tests/                      ← Test suites (~141 files, 3,548 tests)
│       └── docs/                       ← Plugin documentation
├── var/                                ← scripts, templates
├── README.md
└── *.base, *.canvas                    ← vault files
```

### Key Facts

- **Git root** = Obsidian vault root (not plugin root)
- **npm/tsc/esbuild** all run from `Development/flowti/`
- **Build output** navigates 2 levels up: `../../.obsidian/plugins/flowti-ibde/`
- **No `.github/`** directory exists (no CI/CD)
- **Root `.gitignore`** excludes vault content dirs + `.obsidian/plugins`
- **node_modules** lives at `Development/flowti/node_modules/`

## Path Dependency Inventory

Every relative path that would break if the build root moves:

| File | Path Reference | Current Resolution |
|------|---------------|-------------------|
| `esbuild.config.mjs` | `cwd(), "..", ".."` → `.obsidian/plugins/` | 2-level parent traversal from `Development/flowti/` |
| `esbuild.config.mjs` | `entryPoints: ["src/main.ts"]` | `Development/flowti/src/main.ts` |
| `esbuild.config.mjs` | `REPORTDIR = "docs/reports/builds"` | `Development/flowti/docs/reports/builds/` |
| `esbuild.config.mjs` | `ENDPOINTS_FILE = "docs/reports/build-endpoints.json"` | Distribution config |
| `esbuild.config.mjs` | `templatePath = "docs/templates/Build Report.md"` | Build report template |
| `esbuild.config.mjs` | `manifestPath = __dirname, "manifest.json"` | `Development/flowti/manifest.json` |
| `vitest.config.ts` | `obsidian` alias → `./tests/mocks/obsidian-stub.ts` | Test mock |
| `vitest.config.ts` | `src/main` alias → `./tests/mocks/main-stub.ts` | Test mock |
| `vitest.config.ts` | `src` alias → `./src` | Source alias for imports |
| `vitest.config.ts` | `include: ["tests/**/*"]` | Test file discovery |
| `vitest.config.ts` | `outputFile: "docs/reports/tests/testreport.json"` | Test report output |
| `vitest.config.ts` | `reportsDirectory: "docs/reports/tests/"` | Coverage output |
| `eslint.config.mjs` | `project: "./tsconfig.json"` | TypeScript parser |
| `tsconfig.json` | `baseUrl: "."` | Import resolution root |
| `tsconfig.json` | `include: ["**/*.ts"]` | File inclusion |
| `package.json` | `"lint": "eslint ./src/"` | Lint target |
| `package.json` | `"version": "node version-bump.mjs ..."` | Version script |

**Fragility rating: HIGH** — 17 path references across 7 config files. The `esbuild.config.mjs` OUTDIR calculation (`cwd(), "..", ".."`) is the single most fragile path.

## Obsidian Marketplace Requirements

For community plugin submission, Obsidian requires:

1. **`manifest.json` at repo root** — the community plugin browser reads this from GitHub's default branch
2. **GitHub Release** — tagged with version matching `manifest.json` (no "v" prefix)
3. **Release assets** — `main.js` and `manifest.json` attached to the release
4. **Optional**: `styles.css` as release asset

The marketplace does NOT require `package.json` at root — it only reads `manifest.json` and release assets.

## Constraints

### Hard Constraints
1. **Vault is the git root** — the Obsidian vault at `c:\Projects\flowti` IS the git repository. Vault content (notes, canvas files, base files) lives alongside the plugin source.
2. **manifest.json must be at repo root** — required by Obsidian community plugin marketplace.
3. **Build output must land in `.obsidian/plugins/flowti-ibde/`** — this is how the plugin loads during development.
4. **`data.json` must never be overwritten** — plugin persists user state here; build system already respects this.
5. **Distribution to other vaults** — `build-endpoints.json` configures target vaults for multi-vault distribution.

### Soft Constraints
6. **Developer experience** — `npm install && npm test` should work with minimal setup instructions.
7. **Vault content isolation** — plugin source should not contaminate vault navigation, and vault content should not interfere with builds.
8. **No CI/CD yet** — no GitHub Actions pipeline exists. Migration should not block future CI setup.
9. **git history preservation** — restructure should use `git mv` where possible.

## Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q-1 | Can we have `node_modules` at repo root without Obsidian indexing it? | If Obsidian indexes node_modules, vault performance degrades. Root `.gitignore` would need `node_modules` and Obsidian's `.obsidian/` config may need exclusion. | **Open** — needs testing |
| Q-2 | Does Obsidian follow `.gitignore` for vault indexing? | If not, moving `node_modules` to root creates a vault indexing problem. | **Open** — needs testing |
| Q-3 | Should we keep source in `Development/flowti/` or move to root-level `src/`? | Moving source to root would require updating ~230 import paths. Keeping it in place means config files reference `Development/flowti/src/`. | **Open** — tradeoff analysis needed |
| Q-4 | How does distribution work post-restructure? | The `build-endpoints.json` copies assets to other vaults. If the build root changes, distribution paths need updating. | **Open** — test after restructure |
| Q-5 | Can symlinks/junctions solve manifest.json placement? | Windows NTFS supports junctions. A junction from root `manifest.json` to `Development/flowti/manifest.json` could solve placement without file duplication. | **Open** — needs git compatibility testing |
| Q-6 | How will GitHub Release automation work? | No CI exists yet. Manual releases are fine for v1. But the release tag must match `manifest.json` version exactly. | **Deferred** — solve when CI is built |

## Options

### Option A: Minimal Root Migration (Recommended)

Move only what the marketplace requires to the repo root. Keep source, tests, and docs where they are.

**What moves to root:**
- `manifest.json` (required by marketplace)
- `versions.json` (required by marketplace)
- `package.json` (so `npm install` works from root)
- `package-lock.json` (npm lockfile)
- `tsconfig.json` (TypeScript resolution base)
- `esbuild.config.mjs` (build entry point)
- `eslint.config.mjs` (linting config)
- `vitest.config.ts` (test config)
- `version-bump.mjs` (version script)
- `LICENSE` (standard repo root file)

**What stays in place:**
- `Development/flowti/src/` (source code)
- `Development/flowti/tests/` (tests)
- `Development/flowti/docs/` (documentation)
- `Development/flowti/styles.css` (or move to root — trivial)
- `Development/flowti/.hotreload` (development helper)

**Path changes required:**

| File | Change |
|------|--------|
| `esbuild.config.mjs` | `entryPoints` → `"Development/flowti/src/main.ts"`, OUTDIR → `".obsidian/plugins/flowti-ibde/"` (no `../..`), report/template paths → `"Development/flowti/docs/..."` |
| `tsconfig.json` | `include` → `["Development/flowti/**/*.ts"]`, `baseUrl` stays `"."` |
| `vitest.config.ts` | All aliases → `"./Development/flowti/..."`, include → `"Development/flowti/tests/**/*"` |
| `eslint.config.mjs` | Project → `"./tsconfig.json"` (no change if tsconfig at root) |
| `package.json` | lint script → `"eslint ./Development/flowti/src/"` |
| Root `.gitignore` | Add `node_modules`, remove redundant exclusions |

**Pros:**
- Satisfies marketplace requirement (manifest.json at root)
- `npm install && npm test` works from root
- Source code doesn't move — zero import path changes in `src/`
- git history preserved for source files
- Minimal disruption

**Cons:**
- Config files reference `Development/flowti/` prefix — unusual but functional
- `node_modules` at root may need Obsidian exclusion
- Verbose paths in config files

**Risk:** Medium — 7 config files need path updates, but source code is untouched.

### Option B: Full Monorepo Restructure

Move everything to standard locations at root.

```
c:\Projects\flowti/
├── src/                    ← moved from Development/flowti/src/
├── tests/                  ← moved from Development/flowti/tests/
├── docs/                   ← moved from Development/flowti/docs/
├── vault/                  ← vault content moved here (or stays at root with exclusions)
├── package.json
├── manifest.json
├── ...
```

**Pros:**
- Clean standard structure
- Short config paths (`src/`, `tests/`, `docs/`)

**Cons:**
- ~370 files need `git mv` — massive history disruption
- All cross-references in docs (wikilinks) break if vault moves
- Risk of breaking Obsidian vault structure
- Every import in source files that uses relative paths needs review
- Much higher risk than Option A

**Risk:** High — vault disruption, wikilink breakage, large git diff.

### Option C: Separate Publication Repo

Keep development in the current repo. Create a separate `flowti-ibde` repo for publication that contains only `main.js`, `manifest.json`, `styles.css`, `versions.json`.

**Pros:**
- Zero changes to current repo
- Clean publication repo
- Vault structure preserved

**Cons:**
- Two repos to maintain
- Manual sync between repos on release
- Doesn't solve `npm install` from root (developer setup)
- Build artifacts committed to publication repo

**Risk:** Low (current repo), but adds operational overhead.

### Option D: Root Shim Approach

Keep all config in `Development/flowti/`. Add only `manifest.json` and a thin `package.json` shim at root that delegates to the plugin directory.

Root `package.json`:
```json
{
  "private": true,
  "scripts": {
    "install": "cd Development/flowti && npm install",
    "build": "cd Development/flowti && npm run build",
    "test": "cd Development/flowti && npm test",
    "check": "cd Development/flowti && npm run check"
  }
}
```

**Pros:**
- Minimal file changes (2 files added at root)
- All config stays in place — zero path updates
- Marketplace gets `manifest.json` at root

**Cons:**
- Root `package.json` is a shim — confusing for contributors
- `cd` delegation may behave differently on different shells
- npm install at root doesn't install dependencies (delegates)
- node_modules stays nested — some tools may not find it

**Risk:** Low — but feels hacky.

## Recommendation

**Option A: Minimal Root Migration** is recommended as the first step.

### Why Option A

1. **Satisfies RB-1** with the smallest change surface
2. **Source code stays put** — zero risk of import path breakage across ~230 files
3. **Config files are few** — 7 files with well-understood path dependencies
4. **Reversible** — if it doesn't work, `git revert` restores the original state
5. **Unblocks marketplace submission** — `manifest.json` at root
6. **Unblocks CI** — `npm test` from root

### Migration Checklist (for implementation)

1. [ ] Test: does Obsidian ignore `node_modules` at root? (Q-1, Q-2)
2. [ ] `git mv` config files from `Development/flowti/` to root
3. [ ] Update all 17 path references in 7 config files
4. [ ] Update root `.gitignore` (add `node_modules`, `main.js`)
5. [ ] Move `Development/flowti/.gitignore` entries to root `.gitignore`
6. [ ] Run `npm install` from root — verify `node_modules` created
7. [ ] Run `npm test` from root — all 3,548 tests pass
8. [ ] Run `npm run build` from root — `main.js` output in `.obsidian/plugins/flowti-ibde/`
9. [ ] Run `npm run check` from root — tsc + eslint clean
10. [ ] Verify Obsidian reloads plugin correctly with hot-reload
11. [ ] Verify distribution (`build-endpoints.json`) still works
12. [ ] Update README with new build instructions

### Blocked Until

- **Q-1 and Q-2** are answered — if Obsidian indexes `node_modules`, Option A needs adjustment (possibly `.obsidian/app.json` exclusion or Obsidian `.gitignore` support)
- Can be tested in 5 minutes by creating a `node_modules` folder at root with a dummy file and checking if Obsidian shows it in the file explorer

## Consequences

### If Accepted (Option A)
- `manifest.json` at repo root enables marketplace submission
- All npm commands work from root
- Config files have longer paths (`Development/flowti/src/` instead of `src/`)
- Future CI can run `npm test` from repo root

### If Deferred
- RB-1 remains open
- Marketplace submission blocked
- Can publish via Option C (separate repo) as interim workaround

## Related

- Release Blocker: RB-1 (Repository Structure)
- Cycle: [[Cycle 16 - Improvement Sprint]]
- Marketplace: [[Obsidian Market Research 2026]]
- Build: `Development/flowti/esbuild.config.mjs`
- Distribution: `Development/flowti/docs/reports/build-endpoints.json`
