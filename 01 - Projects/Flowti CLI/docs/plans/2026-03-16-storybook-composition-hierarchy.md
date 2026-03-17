# Storybook Composition Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Flowti CLI Storybook so pages visually compose their child primitives and navigation cards, with standalone components categorized by function below.

**Architecture:** HTML factory functions create DOM elements styled to match the Ink TUI look. Three page patterns (Dashboard, List, Simple) compose primitives inside a terminal-view wrapper. A Node.js generator script reads `configs/sitemap.json` and produces one story file per page, selecting the pattern and injecting mock data. Navigation cards show child page previews.

**Tech Stack:** `@storybook/html-vite` 8.x, vanilla TypeScript factories, Catppuccin Mocha color palette, Node.js generator script.

**Spec:** `docs/specs/2026-03-16-storybook-composition-hierarchy-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/package.json` | Storybook devDependencies + scripts |
| Create | `components/.storybook/main.ts` | Story glob, html-vite framework, telemetry off |
| Create | `components/.storybook/preview.ts` | Dark background, CSS imports |
| Create | `components/terminal-view/terminal-view.ts` | `createTerminalView()` factory |
| Create | `components/terminal-view/terminal-view.css` | Terminal window styling |
| Create | `components/terminal-view/terminal-view.stories.ts` | Layout/TerminalView stories |
| Create | `components/tui/primitives.ts` | All HTML primitive factories |
| Create | `components/tui/primitives.css` | Primitive styling |
| Create | `components/tui/nav-card.ts` | `createNavigationCard()` factory |
| Create | `components/tui/nav-card.css` | Navigation card styling |
| Create | `components/tui/patterns.ts` | Dashboard, List, Simple pattern factories |
| Create | `components/mocks/mock-data.ts` | Per-page mock data objects |
| Create | `components/lib/data-display.stories.ts` | StatCard, StatGrid, Badge stories |
| Create | `components/lib/navigation.stories.ts` | ActionBar, KeyHints, NavigationCard stories |
| Create | `components/lib/layout.stories.ts` | Section, MasterDetail stories (TerminalView lives in terminal-view/) |
| Create | `components/lib/lists.stories.ts` | ScrollableList, SearchInput stories |
| Create | `components/lib/input.stories.ts` | FormField stories |
| Create | `components/pages/*.stories.ts` | 33 page stories (generated) |
| Create | `scripts/generate-storybook.mjs` | Generator script reading sitemap.json |
| Modify | `configs/flowti.config.json:37` | `framework: "angular"` → `"html"` |

---

## Chunk 0: Storybook Scaffold + Terminal View

### Task 1: Create Storybook scaffold

**Files:**
- Create: `components/package.json`
- Create: `components/.storybook/main.ts`
- Create: `components/.storybook/preview.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "flowti-cli-components",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "devDependencies": {
    "storybook": "^8.6.0",
    "@storybook/html-vite": "^8.6.0",
    "@storybook/addon-essentials": "^8.6.0"
  }
}
```

- [ ] **Step 2: Create .storybook/main.ts**

```typescript
import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
	stories: ["../**/*.stories.ts"],
	framework: "@storybook/html-vite",
	core: {
		disableTelemetry: true,
	},
};

export default config;
```

- [ ] **Step 3: Create .storybook/preview.ts**

```typescript
import "../terminal-view/terminal-view.css";
import "../tui/primitives.css";
import "../tui/nav-card.css";

export const parameters = {
	backgrounds: {
		default: "dark",
		values: [
			{ name: "dark", value: "#11111b" },
			{ name: "light", value: "#eff1f5" },
		],
	},
};
```

- [ ] **Step 4: Install dependencies**

Run: `cd "01 - Projects/Flowti CLI/components" && npm install`
Expected: node_modules created, 0 vulnerabilities

- [ ] **Step 5: Update flowti.config.json framework**

Change `configs/flowti.config.json` line 37: `"framework": "angular"` → `"framework": "html"`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/package.json" \
       "01 - Projects/Flowti CLI/components/.storybook/main.ts" \
       "01 - Projects/Flowti CLI/components/.storybook/preview.ts" \
       "01 - Projects/Flowti CLI/configs/flowti.config.json"
git commit -m "feat(storybook): scaffold html-vite Storybook with dark theme"
```

---

### Task 2: Create terminal-view component

**Files:**
- Create: `components/terminal-view/terminal-view.ts`
- Create: `components/terminal-view/terminal-view.css`
- Create: `components/terminal-view/terminal-view.stories.ts`

- [ ] **Step 1: Create terminal-view.ts**

Factory function `createTerminalView(props)` that returns an HTMLElement with:
- Outer div `.terminal-view` with configurable width (default 80ch)
- Title bar div `.terminal-view--title-bar` with dot-trio (3 colored spans) + title text
- Content div `.terminal-view--content` (empty slot for page content)
- `showTitleBar` prop (default true) to toggle title bar

Interface:
```typescript
export interface TerminalViewProps {
	title?: string;
	width?: number;
	showTitleBar?: boolean;
}
```

- [ ] **Step 2: Create terminal-view.css**

Catppuccin Mocha palette:
- `.terminal-view` — background `#1e1e2e`, color `#cdd6f4`, border-radius 8px, monospace font stack, box-shadow
- `.terminal-view--title-bar` — flex row, background `#181825`, border-bottom `#313244`, padding 8px 12px
- `.terminal-view--dots` — flex row, gap 6px; `.terminal-view--dot` — 12px circles with colors `#ff5f56`, `#ffbd2e`, `#27c93f`
- `.terminal-view--title` — 12px, color `#a6adc8`
- `.terminal-view--content` — padding 16px 20px, line-height 1.6

- [ ] **Step 3: Create terminal-view.stories.ts**

```typescript
import type { Meta, StoryObj } from "@storybook/html-vite";
import { createTerminalView } from "./terminal-view.js";

const meta: Meta = {
	title: "Components/Layout/TerminalView",
	tags: ["autodocs"],
	argTypes: {
		title: { control: "text", description: "Window title" },
		width: { control: "number", description: "Width in ch units" },
		showTitleBar: { control: "boolean", description: "Show the title bar" },
	},
	args: { title: "Flowti CLI", width: 80, showTitleBar: true },
	render: (args) => {
		const view = createTerminalView(args);
		view.querySelector(".terminal-view--content")!.textContent =
			"Welcome to Flowti CLI — definition-driven project orchestrator.";
		return view;
	},
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const NoTitleBar: Story = { args: { showTitleBar: false } };
export const NarrowWidth: Story = { args: { width: 50, title: "Narrow Terminal" } };
```

- [ ] **Step 4: Verify in Storybook**

Run: `cd "01 - Projects/Flowti CLI/components" && npm run storybook`
Expected: Storybook opens at http://localhost:6006, Components/Layout/TerminalView shows 3 stories with dark terminal window

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/terminal-view/"
git commit -m "feat(storybook): add terminal-view layout component"
```

---

## Chunk 1: TUI Primitives

### Task 3: Create HTML primitive factories

**Files:**
- Create: `components/tui/primitives.ts`
- Create: `components/tui/primitives.css`

- [ ] **Step 1: Create primitives.ts**

Export these factory functions, each returning an HTMLElement:

| Factory | Element structure |
|---------|-------------------|
| `createBadge({ text, color? })` | `span.tui-badge` with `[text]` |
| `createStatCard({ label, value, trend?, color? })` | `div.tui-stat-card` → label div + value div + optional trend div |
| `createStatGrid(stats[])` | `div.tui-stat-grid` → multiple StatCards |
| `createSection({ title, children, collapsible? })` | `div.tui-section` → header (`─ Title` or `▶ Title` if collapsed) + body with children |
| `createActionBar(actions[])` | `div.tui-action-bar` → spans with bold key + label |
| `createKeyHints(hints[])` | `div.tui-key-hints` → spans with key + description |
| `createScrollableList(items[], selected)` | `div.tui-list` → item rows with `▶` selection indicator |
| `createMasterDetail(master, detail?, masterWidth?)` | `div.tui-master-detail` → left pane (configurable width, default 30ch) + right pane |
| `createSearchInput({ placeholder, value? })` | `div.tui-search-input` → input-like div |
| `createFormField({ label, type, value?, placeholder?, required?, options? })` | `div.tui-form-field` → label + input representation |
| `text(content, { bold?, dim?, color? })` | `span.tui-text` with modifier classes |
| `textLine(content, opts?)` | `div.tui-text-line` — block-level text |

Interfaces:
```typescript
export interface BadgeProps { text: string; color?: string; }
export interface StatCardData { label: string; value: string | number; trend?: string; color?: string; }
export interface SectionProps { title: string; children: HTMLElement | HTMLElement[]; collapsible?: boolean; }
export interface ActionDef { key: string; label: string; }
export interface KeyHintDef { key: string; description: string; }
export interface ListItem { content: HTMLElement; selected?: boolean; }
export interface FormFieldProps { label: string; type: string; value?: string; placeholder?: string; required?: boolean; options?: { value: string; label: string }[]; }
```

- [ ] **Step 2: Create primitives.css**

Styles for every primitive class. Key design tokens:
- Card border: `1px solid #585b70`, border-radius 6px
- Section header: bold, color `#89b4fa` (Catppuccin blue)
- Action bar key: bold, color `#89b4fa`
- List selected: color `#89dceb` (Catppuccin teal), bold, `▶` indicator
- Master-detail border: `1px solid #585b70` between panes
- Dim text: opacity 0.5
- Form field: border-bottom `1px solid #585b70`, padding

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/tui/primitives.ts" \
       "01 - Projects/Flowti CLI/components/tui/primitives.css"
git commit -m "feat(storybook): add TUI HTML primitive factories + CSS"
```

---

### Task 4: Create navigation card component

**Files:**
- Create: `components/tui/nav-card.ts`
- Create: `components/tui/nav-card.css`

- [ ] **Step 1: Create nav-card.ts**

```typescript
export interface NavigationCardProps {
	label: string;
	icon?: string;
	description: string;
	actionCount: number;
	onClick?: () => void;
}
```

`createNavigationCard(props)` returns:
- `div.tui-nav-card` with left-accent border
- Title row: icon (if present) + bold label
- Description: one-line dim text
- Badge: `createBadge({ text: "${actionCount} actions", color: "#89b4fa" })`

`createNavigationCardGrid(cards[])` returns:
- `div.tui-nav-card-grid` — CSS grid, 2 columns, gap 8px

- [ ] **Step 2: Create nav-card.css**

- `.tui-nav-card` — border-left 3px solid `#89b4fa`, padding 8px 12px, background `#181825`, border-radius 4px
- `.tui-nav-card--title` — bold, font-size 14px
- `.tui-nav-card--description` — dim, font-size 12px, one-line truncate
- `.tui-nav-card-grid` — display grid, grid-template-columns `1fr 1fr`, gap 8px

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/tui/nav-card.ts" \
       "01 - Projects/Flowti CLI/components/tui/nav-card.css"
git commit -m "feat(storybook): add navigation card component"
```

---

## Chunk 2: Component Library Stories

### Task 5: Create component library stories

**Files:**
- Create: `components/lib/data-display.stories.ts`
- Create: `components/lib/navigation.stories.ts`
- Create: `components/lib/layout.stories.ts`
- Create: `components/lib/lists.stories.ts`
- Create: `components/lib/input.stories.ts`

- [ ] **Step 1: Create data-display.stories.ts**

Three story groups: `Components/Data Display/StatCard`, `Components/Data Display/StatGrid`, `Components/Data Display/Badge`.

StatCard stories: Default, WithTrend, Colored (green value), LargeNumber.
StatGrid stories: Default (4 cards), TwoCards, SingleCard.
Badge stories: Default, Colored (cyan), Status (green "active").

Each uses `autodocs` tag and `argTypes` for all props.

- [ ] **Step 2: Create navigation.stories.ts**

Three story groups: `Components/Navigation/ActionBar`, `Components/Navigation/KeyHints`, `Components/Navigation/NavigationCard`.

ActionBar stories: Default (3 actions), SingleAction, ManyActions (6+).
KeyHints stories: Default (4 hints).
NavigationCard stories: Default, WithIcon, Grid (6 cards in 2-column grid).

- [ ] **Step 3: Create layout.stories.ts**

Two story groups: `Components/Layout/Section`, `Components/Layout/MasterDetail`.

Section stories: Default, Collapsible, WithMultipleChildren.
MasterDetail stories: Default (list + detail), MasterOnly (no detail pane), Widemaster (masterWidth: 50).

**Note:** TerminalView stories live in `terminal-view/terminal-view.stories.ts` (Task 2). Do NOT re-create them in `layout.stories.ts`.

- [ ] **Step 4: Create lists.stories.ts**

Two story groups: `Components/Lists/ScrollableList`, `Components/Lists/SearchInput`.

ScrollableList stories: Default (5 items, 2nd selected), EmptyList, SingleItem.
SearchInput stories: Default, WithValue.

- [ ] **Step 5: Create input.stories.ts**

One story group: `Components/Input/FormField`.

FormField stories: TextField, SelectField (with options), CheckboxField, RequiredField.

- [ ] **Step 6: Verify in Storybook**

Run: `cd "01 - Projects/Flowti CLI/components" && npm run storybook`
Expected: All 5 categories visible in sidebar under Components/, each with subcategories and variant stories. Controls work.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/lib/"
git commit -m "feat(storybook): add component library stories with functional grouping"
```

---

## Chunk 3: Page Patterns + Mock Data

### Task 6: Create page pattern factories

**Files:**
- Create: `components/tui/patterns.ts`

- [ ] **Step 1: Create patterns.ts**

Three factory functions, each returning an HTMLElement (the content to inject into the terminal-view). `patterns.ts` has no associated CSS file — it composes existing primitives from `primitives.ts` and `nav-card.ts`.

**`createDashboardContent(config)`**
```typescript
interface DashboardConfig {
	stats: StatCardData[];
	sections: { title: string; content: HTMLElement | HTMLElement[] }[];
	actions?: ActionDef[];
}
```
Composes: `createStatGrid(stats)` → for each section: `createSection(...)` → `createActionBar(actions)`.

**`createListContent(config)`**
```typescript
interface ListConfig {
	items: ListItem[];
	selected: number;
	detail?: HTMLElement;
	actions?: ActionDef[];
}
```
Composes: if detail provided, `createMasterDetail(createScrollableList(...), detail)`, else just `createScrollableList(...)` → `createActionBar(actions)`.

**`createSimpleContent(actions)`**
```typescript
interface SimpleAction {
	name: string;
	label: string;
	key?: string;
	group?: string;
	type?: string;
	hidden?: boolean | string;
	disabled?: boolean | string;
}
```
Renders grouped action-list with key + label + group separators (same logic as the original terminal-page factory).

**`createPageStory(config)`**
```typescript
interface PageStoryConfig {
	title: string;
	description: string;
	content: HTMLElement;
	navCards?: NavigationCardProps[];
}
```
Master composer: `createTerminalView({ title })` → inject page header (h2 + p) → inject content → inject `createNavigationCardGrid(navCards)`.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/tui/patterns.ts"
git commit -m "feat(storybook): add Dashboard, List, Simple page pattern factories"
```

---

### Task 7: Create mock data

**Files:**
- Create: `components/mocks/mock-data.ts`

- [ ] **Step 1: Create mock-data.ts**

Export `PAGE_MOCKS: Record<string, PageMockData>` keyed by sitemap page ID.

```typescript
interface PageMockData {
	pattern: "dashboard" | "list" | "simple";
	title: string;              // template tokens replaced
	description: string;        // template tokens replaced
	dashboard?: DashboardConfig;
	list?: ListConfig;
	simpleActions?: SimpleAction[];
}
```

**Dashboard mocks** (10 pages):
- `start`: stats = [Projects: 2, Agents: 18, Iteration: #5, Progress: 72%], sections = [Active Iteration, Agent Roster]
- `project-detail`: stats = [Source Files: 460, Test Files: 400], sections = [Project: Flowti CLI]
- `agent-detail`: stats = [Skills: 4, Tools: 6, Tasks: 3], sections = [Agent Info, Permissions]
- `devtools`: stats = [Lint Errors: 0, Complexity: 8.2], sections = [Code Quality]
- `knowledgebase`: stats = [Documents: 24, Categories: 6], sections = [Recent Documents]
- `make`: stats = [Templates: 2, Components: 12], sections = [Available Templates]
- `plugins`: stats = [Installed: 1, Available: 0], sections = [Plugin List]
- `publish`: stats = [Artifacts: 6, Endpoints: 1], sections = [Distribution]
- `reports`: stats = [Generators: 8, Last Run: "2h ago"], sections = [Available Reports]
- `review`: stats = [Journeys: 5, Last Build: "passing"], sections = [Review Pipeline]

**List mocks** (14 pages):
- `ai-tools`: 5 agents with name, type badge, domain
- `iterations`: 4 iterations with number, name, status badge, scope progress
- `resources`, `timelog`, `deliverables`, `raid`, `capa`, `lifecycle`: 3-4 items each with name + status
- `requirements`: 4 requirements with ID, title, status
- `event-catalog`: 5 events with name, domain
- `components`: 4 components with name, kind badge
- `workspaces`: 2 workspaces with name, branch
- `onboarding-tour`, `onboarding-checklist`: 3 items each

**Simple mocks** (9 pages):
Simple pages do NOT have entries in `PAGE_MOCKS`. Their title, description, and actions are read directly from the sitemap by the generator and inlined into the story file. The generator uses `LABEL_OVERRIDES` for the display title and `TOKEN_MOCKS` for template replacement.

**Template token replacements:**
```typescript
const TOKEN_MOCKS: Record<string, string> = {
	"{{project.name}}": "Flowti CLI",
	"{{params.agentName}}": "Software Architect",
	"{{params.componentName}}": "StatCard",
	"{{params.number}}": "5",
};
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/mocks/mock-data.ts"
git commit -m "feat(storybook): add per-page mock data for 33 sitemap pages"
```

---

## Chunk 4: Page Story Generator + Final Verification

### Task 8: Create the generator script

**Files:**
- Create: `scripts/generate-storybook.mjs`

- [ ] **Step 1: Create generate-storybook.mjs**

Node.js script that:

1. Reads `configs/sitemap.json`
2. For each of the 33 pages:
   a. Looks up pattern from the `PATTERN_MAP` constant (dashboard/list/simple)
   b. Determines navigation cards: filter actions by `type === "navigate" || type === "form"`, look up target page in sitemap, extract label/description/action count
   c. Replaces template tokens in label/description
   d. Writes a `.stories.ts` file to `components/pages/{pageId}.stories.ts`
3. Each generated story file:
   - Imports `createPageStory` from `../tui/patterns`
   - Imports pattern-specific content factory from `../tui/patterns`
   - Imports mock data from `../mocks/mock-data`
   - Exports a `meta` with `title: "Pages/{PascalCaseLabel}"` and a Default story

The `PATTERN_MAP` constant:
```javascript
const PATTERN_MAP = {
	// Dashboard
	start: "dashboard", "project-detail": "dashboard", "agent-detail": "dashboard",
	devtools: "dashboard", knowledgebase: "dashboard", make: "dashboard",
	plugins: "dashboard", publish: "dashboard", reports: "dashboard", review: "dashboard",
	// List
	"ai-tools": "list", iterations: "list", resources: "list", timelog: "list",
	deliverables: "list", raid: "list", capa: "list", lifecycle: "list",
	requirements: "list", "event-catalog": "list", components: "list",
	workspaces: "list", "onboarding-tour": "list", "onboarding-checklist": "list",
	// Simple (everything else falls back to simple)
};
```

The `LABEL_OVERRIDES` constant — maps page IDs to desired sidebar display names when the sitemap label differs from the intended Storybook title:
```javascript
const LABEL_OVERRIDES = {
	"management": "Management",
	"ai-tools": "AI Tools",
	"agents-chat": "Agents Chat",
	"agents-dashboard": "Agents Dashboard",
	"onboarding-checklist": "Onboarding Checklist",
	"reports": "Reports",
	"docs": "Docs",
};
```
The generator uses `LABEL_OVERRIDES[pageId] ?? sitemapLabel` for the sidebar title.

**Two template variants** — the generator branches on pattern type:

Template for **Dashboard/List** pages:
```typescript
import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, create${Pattern}Content } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";

const mock = PAGE_MOCKS["${pageId}"];
const navCards = ${JSON.stringify(navCards)};

const meta: Meta = {
	title: "Pages/${DisplayLabel}",
	render: () => createPageStory({
		title: mock.title,
		description: mock.description,
		content: create${Pattern}Content(mock.${pattern}!),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;
export const Default: Story = {};
```

Template for **Simple** pages (no mock lookup — actions inline from sitemap):
```typescript
import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";

const navCards = ${JSON.stringify(navCards)};
const actions = ${JSON.stringify(sitemapActions)};

const meta: Meta = {
	title: "Pages/${DisplayLabel}",
	render: () => createPageStory({
		title: "${title}",
		description: "${description}",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;
export const Default: Story = {};
```

**Validation**: after generating all 33 files, the script asserts that every page ID from the sitemap has a corresponding story file. If any are missing, it exits with an error listing the gaps.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/scripts/generate-storybook.mjs"
git commit -m "feat(storybook): add sitemap-to-stories generator script"
```

---

### Task 9: Generate stories and verify

- [ ] **Step 1: Run the generator**

Run: `cd "01 - Projects/Flowti CLI" && node scripts/generate-storybook.mjs`
Expected: "Generated 33 page stories" output, 33 files created in `components/pages/`

- [ ] **Step 2: Start Storybook and verify**

Run: `cd "01 - Projects/Flowti CLI/components" && npm run storybook`
Expected:
- Sidebar shows `Pages/` with 33 entries ordered by navigation depth
- Sidebar shows `Components/` with 5 subcategories (Data Display, Navigation, Layout, Lists, Input)
- `Pages/Start Menu` renders: terminal window → stat grid (4 cards) → 2 sections → action bar → navigation cards for project-detail, ai-tools, plugins
- `Pages/AI Tools` renders: terminal window → scrollable list (5 agents with badges) → action bar → navigation card for agent-detail
- `Pages/Management` renders: terminal window → grouped action-list with separators → navigation cards for resources, timelog, deliverables, etc.
- `Components/Data Display/StatCard` renders: standalone card with Storybook controls

- [ ] **Step 3: Commit all generated stories**

```bash
git add "01 - Projects/Flowti CLI/components/pages/"
git commit -m "feat(storybook): generate 33 page stories from sitemap with composition hierarchy"
```

- [ ] **Step 4: Final commit with all files**

```bash
git add -A "01 - Projects/Flowti CLI/components/" "01 - Projects/Flowti CLI/scripts/generate-storybook.mjs"
git commit -m "feat(storybook): complete composition hierarchy — pages, components, patterns, mock data"
```
