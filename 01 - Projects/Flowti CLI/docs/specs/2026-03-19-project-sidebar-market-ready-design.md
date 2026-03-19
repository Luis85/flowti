# Project Sidebar — Market-Ready Polish + Import from Git

**Date:** 2026-03-19
**Status:** Draft
**Scope:** Flowti Plugin — Project Detail Sidebar

## Summary

Make the project sidebar the complete onboarding surface for Flowti. A new user opens the sidebar, imports a project from Git (or creates one), and Flowti bootstraps it with config detection and a guided wizard. Alongside this, targeted UX polish fixes feedback consistency, keyboard support, and empty states.

## Feature 1: Add Project Dropdown

### Trigger
A "+" button in the project list header row, right-aligned next to the "Projects" title.

### Dropdown Menu
Anchored to the "+" button using `position: fixed` with viewport-aware positioning (Obsidian sidebars can be narrow). Three items:

| Item | Description | Behavior |
|------|-------------|----------|
| **Import from Git** | Clone as tracked submodule | Opens git modal in `submodule` mode |
| **New from Template** | Clone + detach, untracked copy | Opens git modal in `template` mode |
| **Create Empty** | Bare folder + config + brief | Name prompt only, no wizard |

- Dismisses on outside click or Escape
- Arrow key navigation + Enter to select
- Dispatches `add-project` event with `{ mode: "git" | "template" | "empty" }`

### Create Empty Flow
Prompts for project name only. Executed via CLI command `project:create --name=<name>`. Creates:
- `01 - Projects/{name}/`
- `01 - Projects/{name}/configs/flowti.config.json` (minimal defaults)
- `01 - Projects/{name}/{name}.md` (project brief note)

Refreshes project list. No wizard needed.

---

## Feature 2: Git Import Modal

### Modal: URL + Name Form

Opened by "Import from Git" or "New from Template" dropdown items.

**Fields:**
- **Repository URL** — text input. On blur/paste, auto-normalizes the URL.
- **Project Name** — text input. Auto-fills from repo name when URL changes. Editable. Path preview below: `→ 01 - Projects/{name}/`
- **Mode indicator** — read-only label showing "Submodule (tracked)" or "Template (detached copy)" based on which dropdown item was selected. Not a toggle.

**URL Normalization Rules:**

| Host | Input Pattern | Normalized To |
|------|--------------|---------------|
| GitHub | `https://github.com/user/repo` | `https://github.com/user/repo.git` |
| GitHub | `https://github.com/user/repo/tree/main/...` | `https://github.com/user/repo.git` |
| GitHub | `git@github.com:user/repo.git` | pass-through |
| GitLab | `https://gitlab.com/user/repo/-/tree/main` | `https://gitlab.com/user/repo.git` |
| Bitbucket | `https://bitbucket.org/user/repo/src/main` | `https://bitbucket.org/user/repo.git` |
| Azure DevOps | `https://dev.azure.com/org/project/_git/repo` | pass-through |
| Azure DevOps | `https://org.visualstudio.com/project/_git/repo` | `https://dev.azure.com/org/project/_git/repo` |
| Azure DevOps | `https://dev.azure.com/org/project/_git/repo?path=...&version=...` | strip query params |
| Generic | any `.git` URL | pass-through |

**Repo name extraction:** last path segment, strip `.git` suffix, used to pre-fill project name.

**Validation:**
- "Setup" button disabled until URL is non-empty and name doesn't conflict with existing `01 - Projects/{name}/` folder
- Inline error on conflict: "A project named '{name}' already exists"

**Actions:** Cancel (returns to project list), Setup (starts clone)

---

### Modal: Progress State

After clicking "Setup", the form content is replaced with progress view.

**Steps executed in sequence:**

1. **Cloning repository...** — `git submodule add <url> "01 - Projects/{name}"` (submodule mode) or `git clone <url> "01 - Projects/{name}"` (template mode)
2. **Detaching from remote...** — template mode only: remove `.git/` directory. On Windows, uses shell `rmdir /s /q` to avoid Node.js file-locking issues with `.git/` contents. Template mode never touches `.gitmodules`.
3. **Detecting project...** — scan for project markers (feeds into wizard step 1)
4. **Done** — transitions to bootstrap wizard

**Output log:** scrollable monospace area showing real git output. Same styling as storybook output log. Progress streaming works via `VaultProjectService` which uses `spawnBackground` with `onOutput` callback. `HttpProjectService` does not support streaming — it awaits the full result.

**Cancel:** sends abort signal to the running git process via `AbortController`, removes partial folder, returns to URL form with fields preserved. The `importFromGit` service method accepts an `AbortSignal` parameter for cancellation.

**Error handling:**

| Error | Message | Recovery |
|-------|---------|----------|
| Auth failure | "Authentication failed. For private repos, ensure git credentials are configured." | Return to form, fields preserved |
| Network / invalid URL | "Could not reach repository. Check the URL and try again." | Return to form, fields preserved |
| Folder conflict (race) | "Folder already exists." | Return to form, fields preserved |

---

### Modal: Bootstrap Wizard

After clone + detect, modal becomes a three-step wizard.

**Step indicator bar:** three numbered circles with labels ("Detect", "Configure", "Done"). Active step highlighted with `--interactive-accent` color. Completed steps show a check. Same pattern as the existing `renderStepBar` helper in `src/ui/hub/helpers.ts`.

**Focus management:** first focusable element in each step receives focus on step entry. Tab cycles through inputs. Enter on the primary button advances to the next step.

**Step 1: Detect (auto-completed, read-only)**

Displays what Flowti found in the repo:

| Field | Detection Source |
|-------|-----------------|
| Type | `tsconfig.json` exists → typescript, else javascript |
| Framework | `angular.json` → Angular, `vite.config.*` + react dep → React, `next.config.*` → Next.js, `nuxt.config.*` → Nuxt, `vue` dep → Vue, `svelte` dep → Svelte |
| Package manager | `package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, `bun.lockb` → bun |
| Test framework | devDeps scan: vitest, jest, mocha, playwright, cypress |
| Has config | `flowti.config.json` or `configs/flowti.config.json` exists |

If `flowti.config.json` already exists: skip step 2, button reads "Finish →".

**Step 2: Configure (pre-filled form)**

| Field | Type | Pre-fill Source |
|-------|------|----------------|
| Build command | text input | `package.json` → `scripts.build` → `npm run build` |
| Test command | text input | `package.json` → `scripts.test` → `npm test` |
| Lint command | text input | `package.json` → `scripts.lint` → `npm run lint` (blank if absent) |
| Storybook framework | button group (none/html/react/vue3/angular/web_components/svelte) | Pre-selected from detection, "none" if not detected |

Framework labels match `StorybookFramework` type: `"html" | "react" | "vue3" | "angular" | "web_components" | "svelte"`. "none" maps to `undefined` (omitted from config).

No complex validation. User confirms or tweaks inferred values.

**Step 3: Done**

Shows summary of what was created:
- `flowti.config.json` (written to `configs/` subfolder)
- Project brief note (`{name}.md`)

Shows "What's next" guidance:
- Open the project to see its dashboard
- Generate a sitemap canvas
- Set up Storybook for components

"Open Project" button dismisses modal and navigates to the project detail view. Project list auto-refreshes.

---

## Feature 3: UX Polish Items

### Keyboard Support
- Escape dismisses any open modal (dropdown, wizard, scaffold modal)
- Enter confirms primary action in modals (Setup, Configure, Finish)
- Arrow keys navigate dropdown items, Enter selects

### Destructive Action Confirmation
- "Regenerate" in storybook section shows inline confirm: the Regenerate button is replaced with "Are you sure? [Confirm] [Cancel]" row. Confirm dispatches `storybook-regenerate-confirmed`, Cancel hides the confirm row. The handler already listens for both events — only the component render path is missing.

### Tooltips
- All action buttons in storybook section, config tab, and project list get `title` attributes

### Empty State Improvements
Project list distinguishes two cases:
- **CLI not connected:** "Waiting for Flowti CLI server..." with subtle pulse animation
- **CLI connected, no projects:** "No projects yet" with prominent "+" add button

---

## Component Changes

### New Components
| Component | Purpose |
|-----------|---------|
| `flowti-add-project-dropdown.ts` | "+" button + dropdown menu (3 items) |
| `flowti-git-import-modal.ts` | URL form → progress → bootstrap wizard |

### Modified Components
| Component | Changes |
|-----------|---------|
| `flowti-project-detail.ts` | Add "+" button in list header, wire dropdown events, pass through to modal |
| `flowti-storybook-section.ts` | Wire regenerate confirm inline UI, add button tooltips |
| `flowti-config-tab.ts` | Add button tooltips |

### New Domain Functions (CLI)
| Function | Location | Purpose |
|----------|----------|---------|
| `normalizeGitUrl(url)` | `src/domain/project/git-url.ts` | Parse + normalize any git host URL |
| `detectProject(path, deps)` | `src/domain/project/project-detect.ts` | Scan cloned repo, return type/framework/pkg-mgr/test/has-config |
| `bootstrapConfig(path, opts, deps)` | `src/domain/project/project-bootstrap.ts` | Write `flowti.config.json` from wizard answers |

### Interface Changes (Plugin)

Added to `IProjectService` in `src/domain/projects/types.ts`:

```typescript
importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback, signal?: AbortSignal): Promise<{ ok: boolean; error?: string }>;
detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; error?: string }>;
bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }>;
createEmptyProject(name: string): Promise<{ ok: boolean; error?: string }>;
```

Both `VaultProjectService` and `HttpProjectService` must implement these methods.

### New CLI Commands
| Command | Purpose |
|---------|---------|
| `project:create --name=<name>` | Create empty project folder + minimal config + brief note |
| `project:detect --project=<name>` | Detect project type, framework, tools |
| `project:bootstrap --project=<name> --build=<cmd> --test=<cmd> --lint=<cmd> --storybook=<framework>` | Write config from provided values |

**Note:** Git clone/submodule operations are handled directly by `VaultProjectService` (not via CLI command), because git must run in the vault root context where `.gitmodules` lives.

### Custom Events (new components)

| Component | Event | Detail | When |
|-----------|-------|--------|------|
| `flowti-add-project-dropdown` | `add-project` | `{ mode: "git" \| "template" \| "empty" }` | Dropdown item selected |
| `flowti-git-import-modal` | `import-setup` | `{ url, name, mode }` | Setup button clicked |
| `flowti-git-import-modal` | `import-cancel` | — | Cancel at any step |
| `flowti-git-import-modal` | `import-abort` | — | Cancel during clone |
| `flowti-git-import-modal` | `wizard-configure` | `{ build, test, lint, storybook }` | Finish in wizard step 2 |
| `flowti-git-import-modal` | `wizard-open-project` | `{ name }` | Open Project in step 3 |

---

## Out of Scope

- Private repo authentication UI (user configures git credentials externally)
- Branch selection during import (clones default branch)
- Monorepo detection / workspace scanning
- npm install / dependency installation (user runs manually or future feature)
- Progress streaming via `HttpProjectService` (only `VaultProjectService` streams output)
