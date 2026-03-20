# Project Detail View — 5-Tab Architecture

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Flowti Plugin — `src/ui/projects/` and `src/components/projects/`

---

## Summary

Restructure the Plugin's project detail view from 2 tabs (Overview, Config) to 5 tabs:

```
Overview | Components | Event Catalog | Reporting | Config
```

Brings the CLI's Reporting and Events domains into the Plugin UI, adds a component registry, and transforms Overview into a project dashboard.

---

## Tab 1: Overview (Project Dashboard)

Four vertically stacked sections:

### 1.1 Brief

Existing project brief: goal, status, start/end dates, description. Open/create note actions. Inline config badges (build modes, test presets, health targets, team/agents, deploy targets).

### 1.2 Health Summary

Executes `flowti health --project=X --format=json` via `IProjectService.getHealth()`. Displays:

- Overall health score (0-100) with color coding (green >= 80, amber >= 60, red < 60)
- Grade letter (A/B/C/D/F)
- Category breakdown bars: tests, coverage, build, lint, security, git (matching CLI's `HealthScore.categories`)
- Refresh button to re-run

**CLI output schema** (from `src/domain/health/health-scoring.ts`):

```typescript
interface HealthScore {
	overall: number;
	grade: string;
	categories: {
		tests: number;
		coverage: number;
		build: number;
		lint: number;
		security: number;
		git: number;
	};
}
```

**Empty/error states:**
- No CLI connection: dimmed section with "CLI not available" message
- No health config: "No health thresholds configured" with link to Config tab
- Command failure: inline error with retry button

### 1.3 Canvas Generators

Existing sitemap preset grid (Web App, Landing, Dashboard, E-Commerce, Enterprise, CLI, Plugin, Docs, System Design, Service Design, Product Design). No changes.

### 1.4 TODO List

Reads/writes `$project/TODO.md` using standard Obsidian checkbox format:

```markdown
- [ ] Implement user auth
- [ ] Write integration tests
- [x] Set up CI pipeline
```

UI provides:
- Text input + "Add" button at top
- Checkbox toggle per item (writes back to markdown)
- Delete button per item
- Items in file order

**File operations:** Use `vault.modify()` (not `vault.adapter.write()`) to stay compatible with Obsidian's internal file cache and avoid conflicts when the file is open in an editor.

**Parse rules:** Lines matching `- \[[ x]\] .+` are TODO items. All other lines (headings, blanks, prose) are preserved in place during write-back. Malformed lines are ignored.

**Empty state:** When `TODO.md` doesn't exist, show empty state with "Create TODO list" button that creates the file.

---

## Tab 2: Components

Two sections:

### 2.1 Component Registry

Reads the Storybook stories directory (`$project/.storybook/stories/` or the configured `markdownSource.path` from Config tab) and parses component markdown files. Each file follows the sitemap markdown import format with YAML frontmatter:

```yaml
---
name: Button
category: UI
status: stable
---
```

Body contains `## Props`, `## Slots`, `## Variants` sections parsed into structured data.

Displays list with:
- Name, category badge, status badge
- Prop count, slot count
- Click to expand: full props table, slots, variants detail

**Data source:** Reuses the same source path resolution and frontmatter parsing logic from `VaultProjectService.importMarkdownSitemap()` — specifically the file discovery and YAML extraction, not the import-into-sitemap action itself. `listComponents()` reads and parses but does not write. If no source is configured, shows "Configure component source in Config tab" message.

Layout designed for future extensibility (component health, usage stats can slot in without restructuring).

### 2.2 Storybook

Relocated from Overview tab. Same existing functionality:

- **Not installed:** Framework selection grid (HTML, React, Vue3, Angular, Web Components, Svelte)
- **Installed (idle):** Start, Preview, Build, Open folder, Regenerate actions
- **Running:** Status bar with URL, View, Stop, Build buttons
- Process log component for command output

No behavioral changes — purely a relocation. All existing Storybook events (`storybook-install`, `storybook-start`, `storybook-stop`, `storybook-build`, etc.) continue to bubble with `composed: true` and are handled by the same listeners in `project-handlers.ts`.

---

## Tab 3: Event Catalog

Sub-tab navigation rendered as a secondary tab bar (smaller font, no border-bottom, underline-style active indicator to visually distinguish from the primary tab bar):

```
Domains | Services | Events | Flows
```

Sub-tab state tracked as a Lit reactive property (`activeSubTab`) on `flowti-tab-event-catalog.ts`.

### 3.1 Entity Types

All 4 are first-class entities persisted as markdown files with YAML frontmatter. `$project` refers to the **vault-relative project path** (e.g., `01 - Projects/Flowti CLI`) for all vault adapter operations.

#### Domain (`$project/docs/catalog/domains/<kebab-name>.md`)

```yaml
---
type: Domain
name: User Management
status: active
date: 2026-03-20
---
```

Body sections: description, `## Services` (bullet list), `## Events` (bullet list).

#### Service (`$project/docs/catalog/services/<kebab-name>.md`)

```yaml
---
type: Service
name: AuthService
domain: User Management
status: active
date: 2026-03-20
---
```

Body sections: description, `## Produces` (bullet list), `## Consumes` (bullet list).

#### Event (`$project/docs/catalog/events/<kebab-name>.md`)

Matches existing CLI format:

```yaml
---
type: Event
name: user.created
domain: user
version: 1.0.0
status: draft
date: 2026-03-20
producers: AuthService
consumers: APIGateway, AnalyticsService
---
```

Body sections: description, `## Producers`, `## Consumers`, `## Payload` (table with Field | Type | Required | Description), `## Version History`.

#### Flow (`$project/docs/catalog/flows/<kebab-name>.md`)

```yaml
---
type: Flow
name: User Onboarding
domain: User Management
status: active
date: 2026-03-20
---
```

Body sections: description, `## Steps` (numbered list with event -> service pairs).

### 3.2 Sub-Tab UI Pattern

Each sub-tab shows:

- Entity list: name, status badge, domain tag, date
- "Add" button at top — opens inline form below the button
- Click row to expand detail view (read-only rendered markdown + edit action)
- Edit action opens the file in Obsidian for full editing
- Refresh button to re-scan directory

**Empty state:** "No [entities] yet. Add one to get started."

### 3.3 Add Forms

Collect required fields per entity type:

| Entity  | Fields                                           |
|---------|--------------------------------------------------|
| Domain  | name, status, description                        |
| Service | name, domain, status, description, produces, consumes |
| Event   | name, domain, version, status, description, producers, consumers, payload fields |
| Flow    | name, domain, status, description, steps         |

On submit: generates markdown file, writes to `$project/docs/catalog/<entity-type>/<kebab-name>.md`, refreshes list.

### 3.4 File Discovery

Reads entity directories on tab activation. Parses YAML frontmatter for list metadata. Does not watch for external changes (manual refresh button).

**Error handling:** Malformed frontmatter is skipped with a warning badge on the item. Missing directories are created on first entity add.

---

## Tab 4: Reporting (Pipeline DAG View)

### 4.1 Pipeline Visualization

Reads `generators` array from project's `flowti.config.json` reports section via `IProjectService.getReportGenerators()`. Renders as a DAG:

- **Nodes:** one per generator, showing label and status badge
- **Edges:** drawn from dependency generators to dependents
- **Layout:** topological order, left-to-right. Generators with no dependencies on the left, dependents further right.

**Rendering approach:** CSS Grid for node positioning (columns = topological layers), SVG overlay for dependency edges between nodes. Each topological layer is a grid column. Nodes within a layer stack vertically. SVG paths connect node centers across columns.

```
[Layer 0]          [Layer 1]        [Layer 2]
┌──────────┐       ┌──────────┐     ┌──────────┐
│ test     │──────▶│ status   │────▶│ summary  │
├──────────┤  ┌───▶├──────────┤ ┌──▶├──────────┤
│ coverage │──┘    └──────────┘ │   └──────────┘
├──────────┤                    │
│ codebase │────────────────────┘
├──────────┤
│complexity│────────────────────┘
└──────────┘
```

### 4.2 Node States

| State    | Badge  | Description                |
|----------|--------|----------------------------|
| not-run  | gray   | Default, never executed    |
| running  | blue   | Currently executing        |
| passed   | green  | Completed successfully     |
| failed   | red    | Completed with errors      |

### 4.3 Node Interaction

Click a node to expand:

- Output log (streamed during execution)
- Metrics (if available from generator output)
- Link to generated report file in vault (clickable, opens in Obsidian)

### 4.4 Controls

- **"Run All"** button — executes `flowti reports --project=X`, updates all node statuses as they complete
- **Individual "Run"** button per node — executes `flowti report:<id> --project=X`
- Prerequisites execute automatically before the generator runs (as defined in config)

### 4.5 Execution

Uses `IProjectService.runReport()` / `IProjectService.runAllReports()` (new methods). These delegate to the existing `runAsync()` pattern in `VaultProjectService` which spawns CLI commands and streams output via `onOutput` callback. On completion, parses result to determine passed/failed and extract metrics.

**Empty state:** When `flowti.config.json` has no `reports.generators` section: "No report generators configured. Add generators to your project's flowti.config.json to use this feature."

---

## Tab 5: Config

Unchanged from current implementation:

- Source folder browser for markdown component import
- Import strategy selection (Category, Flat, Hierarchical)
- Required fields picker (locked: name, category; optional: description, status, props, slots, variants)
- Save button with feedback

Rename file from `flowti-config-tab.ts` to `flowti-tab-config.ts` for naming consistency with new tab files.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/components/projects/flowti-tab-overview.ts` | Overview tab: brief + health + canvas + TODOs |
| `src/components/projects/flowti-tab-components.ts` | Components tab: registry + storybook |
| `src/components/projects/flowti-tab-event-catalog.ts` | Event Catalog tab: sub-tabbed entity CRUD |
| `src/components/projects/flowti-tab-reporting.ts` | Reporting tab: DAG pipeline view |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/projects/flowti-project-detail.ts` | Refactor to 5-tab routing, extract Overview/Storybook content to new tab components. Parent owns data loading; passes `project`, `config`, `storybook` as Lit properties to child tabs. |
| `src/components/projects/flowti-config-tab.ts` | Rename to `flowti-tab-config.ts` for consistency |
| `src/infrastructure/handlers/project-handlers.ts` | Add handlers: health fetch, TODO CRUD, entity CRUD, report execution. Expand `ProjectHandlerDeps` with `vaultAdapter`. |
| `src/domain/projects/types.ts` | Add new methods to `IProjectService` |
| `src/infrastructure/projects/vault-project-service.ts` | Implement new methods |

### IProjectService Expansion

New methods added to `IProjectService`:

```typescript
// Health
getHealth(project: string): Promise<{ ok: boolean; score?: HealthScore; error?: string }>;

// TODOs — vault-native, not CLI
getTodos(project: string): Promise<{ items: TodoItem[]; exists: boolean }>;
addTodo(project: string, text: string): Promise<{ ok: boolean }>;
toggleTodo(project: string, index: number): Promise<{ ok: boolean }>;
deleteTodo(project: string, index: number): Promise<{ ok: boolean }>;

// Event Catalog entities — vault-native file CRUD
listEntities(project: string, entityType: CatalogEntityType): Promise<CatalogEntity[]>;
createEntity(project: string, entityType: CatalogEntityType, definition: CatalogEntityDef): Promise<{ ok: boolean; path?: string }>;

// Reports
getReportGenerators(project: string): Promise<ReportGeneratorInfo[]>;
runReport(project: string, generatorId: string, onOutput?: OutputCallback): Promise<{ ok: boolean; metrics?: Record<string, number>; outputPath?: string; error?: string }>;
runAllReports(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; results?: ReportResult[]; error?: string }>;

// Components
listComponents(project: string): Promise<ComponentEntry[]>;
```

Supporting types:

```typescript
interface TodoItem { text: string; done: boolean; }
type CatalogEntityType = "domains" | "services" | "events" | "flows";
interface CatalogEntity { name: string; type: string; domain?: string; status: string; date: string; path: string; }
interface CatalogEntityDef { name: string; domain?: string; status?: string; description?: string; [key: string]: unknown; }
interface ReportGeneratorInfo { id: string; label: string; dependencies?: string[]; prerequisites?: string[]; }
interface ReportResult { id: string; label: string; ok: boolean; metrics?: Record<string, number>; outputPath?: string; }
interface ComponentEntry { name: string; category: string; status?: string; propCount: number; slotCount: number; }
```

### ProjectHandlerDeps Expansion

```typescript
export interface ProjectHandlerDeps {
	readonly projectService: IProjectService;
	readonly projectName: string;
	readonly openNote?: (path: string) => void;
	readonly createNote?: (name: string) => void;
	readonly openInWebviewer?: (url: string) => void;
	readonly navigateBack?: () => void;
	readonly pickFolder?: () => Promise<string | null>;
	readonly revealFolder?: (path: string) => void;
	// New: vault file adapter for entity/TODO operations (matching agent-handlers.ts pattern)
	readonly vaultAdapter?: VaultFileAdapter;
}
```

The `VaultFileAdapter` interface is currently defined in `agent-handlers.ts`. During implementation, extract it to a shared module (e.g., `src/infrastructure/vault-adapter.ts`) so both `project-handlers.ts` and `agent-handlers.ts` import from the same location without cross-handler dependencies:

```typescript
interface VaultFileAdapter {
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
	read(path: string): Promise<string>;
}
```

Write operations use `vault.modify()` / `vault.create()` passed through the service layer, not the adapter (which is read-only by design).

### Data Flow

| Feature | Data Source | Mechanism |
|---------|------------|-----------|
| Brief | `IProjectService.getProject()` | Existing |
| Health | `IProjectService.getHealth()` → `flowti health --format=json` | `runAsync()` in VaultProjectService |
| Canvas | `IProjectService.generateSitemapCanvas()` | Existing |
| TODOs | `IProjectService.getTodos/addTodo/toggleTodo/deleteTodo()` | `vault.modify()` for Obsidian-aware writes |
| Components | `IProjectService.listComponents()` | Parse markdown files from configured source |
| Storybook | `IProjectService` storybook methods | Existing |
| Event entities | `IProjectService.listEntities/createEntity()` | `vault.create()` for new files, `VaultFileAdapter.list/read()` for discovery |
| Reports | `IProjectService.runReport/runAllReports()` | `runAsync("flowti", ["report:X", ...])` |
| Config | `IProjectService.saveMarkdownSourceConfig()` | Existing |

### Component Communication

All new tab components follow the existing pattern:
- Lit components dispatch `CustomEvent` with `bubbles: true, composed: true`
- `project-handlers.ts` listens on the container and bridges to services
- State flows back via Lit reactive properties

Parent `flowti-project-detail` owns data loading and passes down to tabs:
- `project: ProjectDetail` — all tabs that need project info
- `config: ProjectConfig` — Overview (badges), Components (source path), Config tab
- `storybook: StorybookStatus` — Components tab

### Entity File Path Convention

All entity paths use **vault-relative paths** (e.g., `01 - Projects/Flowti CLI/docs/catalog/domains/user-management.md`). Entity files live under `$project/docs/catalog/` to avoid collision with existing `docs/events/` used by the CLI's own event definitions. The `catalog/` subdirectory groups all 4 entity types:

```
$project/docs/catalog/
  domains/
  services/
  events/
  flows/
```

---

## Testing Strategy

Each new tab component gets a test file mirroring the source:

| Source | Test |
|--------|------|
| `flowti-tab-overview.ts` | `tests/components/projects/flowti-tab-overview.test.ts` |
| `flowti-tab-components.ts` | `tests/components/projects/flowti-tab-components.test.ts` |
| `flowti-tab-event-catalog.ts` | `tests/components/projects/flowti-tab-event-catalog.test.ts` |
| `flowti-tab-reporting.ts` | `tests/components/projects/flowti-tab-reporting.test.ts` |

Tests use the existing pattern: mock `IProjectService`, mount component, assert renders and event dispatch. Entity CRUD tests verify markdown generation and frontmatter parsing. Handler tests verify service delegation.

---

## Out of Scope

- Event contract validation (CLI domain handles this)
- Event codegen (CLI domain handles this)
- Flow visualization / Mermaid rendering (future enhancement)
- Component health scoring (future enhancement)
- Report diffing / archive browsing (future enhancement)
- Real-time file watching for external changes (manual refresh)
- Entity delete/update from UI (editing opens the file in Obsidian; no UI delete action — deliberate scoping to keep initial implementation focused)
