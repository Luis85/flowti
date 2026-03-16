import type { DashboardConfig, ListConfig } from "../tui/patterns.js";
import { text, textLine, createBadge } from "../tui/primitives.js";

export interface PageMockData {
	pattern: "dashboard" | "list";
	title: string;
	description: string;
	dashboard?: DashboardConfig;
	list?: ListConfig;
}

export const PAGE_MOCKS: Record<string, PageMockData> = {

	// ── Dashboard pages ────────────────────────────────────────────────────────

	"start": {
		pattern: "dashboard",
		title: "Start Menu",
		description: "Entry point — open or create a project, access global tools.",
		dashboard: {
			stats: [
				{ label: "Projects", value: 2 },
				{ label: "Agents", value: 18 },
				{ label: "Iteration", value: "#5" },
				{ label: "Progress", value: "72%", color: "#a6e3a1" },
			],
			sections: [
				{ title: "Active Iteration", content: textLine("#5 Agent World — 72% complete") },
				{ title: "Agent Roster", content: [
					textLine("  Software Architect [ai] architecture"),
					textLine("  Product Owner [ai] product"),
					textLine("  Tester [ai] quality"),
				]},
			],
			actions: [{ key: "1", label: "Open Project" }, { key: "a", label: "Agents" }, { key: "q", label: "Quit" }],
		},
	},

	"project-detail": {
		pattern: "dashboard",
		title: "Project Detail",
		description: "Project diagnostics, health score, and quick actions.",
		dashboard: {
			stats: [
				{ label: "Source Files", value: 460 },
				{ label: "Test Files", value: 400 },
				{ label: "Coverage", value: "84.3%", color: "#a6e3a1" },
				{ label: "Health", value: "A", color: "#a6e3a1" },
			],
			sections: [
				{ title: "Project Info", content: [
					textLine("  Name: Flowti CLI"),
					textLine("  Path: 01 - Projects/Flowti CLI"),
					textLine("  Status: active"),
				]},
			],
			actions: [{ key: "b", label: "Build" }, { key: "t", label: "Test" }, { key: "h", label: "Health" }],
		},
	},

	"agent-detail": {
		pattern: "dashboard",
		title: "Agent Detail",
		description: "Agent configuration, permissions, and task assignment.",
		dashboard: {
			stats: [
				{ label: "Skills", value: 4 },
				{ label: "Tools", value: 6 },
				{ label: "Tasks", value: 3 },
			],
			sections: [
				{ title: "Agent Info", content: [
					textLine("  Name: Software Architect"),
					textLine("  Domain: architecture"),
					textLine("  Type: ai"),
				]},
				{ title: "Permissions", content: [
					textLine("  read: vault"),
					textLine("  write: docs/specs"),
					textLine("  execute: flowti sitemap:validate"),
				]},
			],
			actions: [{ key: "e", label: "Edit" }, { key: "t", label: "Assign Task" }],
		},
	},

	"devtools": {
		pattern: "dashboard",
		title: "Dev Tools",
		description: "Code quality metrics, lint results, and complexity analysis.",
		dashboard: {
			stats: [
				{ label: "Lint Errors", value: 0, color: "#a6e3a1" },
				{ label: "Warnings", value: 0, color: "#a6e3a1" },
				{ label: "Complexity", value: 8.2 },
			],
			sections: [
				{ title: "Code Quality", content: [
					textLine("  Max complexity: 8.2 / 10"),
					textLine("  Max lines: 212 / 350"),
					textLine("  ESLint: 0 errors, 0 warnings"),
				]},
			],
			actions: [{ key: "l", label: "Lint" }, { key: "c", label: "Type Check" }],
		},
	},

	"knowledgebase": {
		pattern: "dashboard",
		title: "Knowledgebase",
		description: "Vault-wide reference documents and agent memory files.",
		dashboard: {
			stats: [
				{ label: "Documents", value: 24 },
				{ label: "Categories", value: 6 },
			],
			sections: [
				{ title: "Recent Documents", content: [
					textLine("  cli-architecture.md"),
					textLine("  sitemap-system.md"),
					textLine("  plugin-architecture.md"),
				]},
			],
			actions: [{ key: "n", label: "New Document" }, { key: "s", label: "Search" }],
		},
	},

	"make": {
		pattern: "dashboard",
		title: "Make / Scaffold",
		description: "Generate new components, journeys, and project scaffolds.",
		dashboard: {
			stats: [
				{ label: "Templates", value: 2 },
				{ label: "Components", value: 12 },
			],
			sections: [
				{ title: "Available Templates", content: [
					textLine("  journey — New user journey"),
					textLine("  component — New UI component"),
				]},
			],
			actions: [{ key: "j", label: "New Journey" }, { key: "c", label: "New Component" }],
		},
	},

	"plugins": {
		pattern: "dashboard",
		title: "Plugins",
		description: "Manage installed plugins and browse the plugin registry.",
		dashboard: {
			stats: [
				{ label: "Installed", value: 1 },
				{ label: "Available", value: 0 },
			],
			sections: [
				{ title: "Plugin List", content: [
					textLine("  flowti-ibde — Obsidian IBDE plugin [installed]"),
				]},
			],
			actions: [{ key: "i", label: "Install" }, { key: "r", label: "Remove" }],
		},
	},

	"publish": {
		pattern: "dashboard",
		title: "Publish",
		description: "Build distribution artifacts and push to configured endpoints.",
		dashboard: {
			stats: [
				{ label: "Artifacts", value: 6 },
				{ label: "Endpoints", value: 1 },
			],
			sections: [
				{ title: "Distribution", content: [
					textLine("  main.js — .flowti/bin/main.js"),
					textLine("  Endpoint: local"),
				]},
			],
			actions: [{ key: "p", label: "Publish" }, { key: "b", label: "Build Only" }],
		},
	},

	"reports": {
		pattern: "dashboard",
		title: "Reports",
		description: "Generate and view project reports across all domains.",
		dashboard: {
			stats: [
				{ label: "Generators", value: 8 },
				{ label: "Last Run", value: "2h ago" },
			],
			sections: [
				{ title: "Available Reports", content: [
					textLine("  coverage — Test coverage summary"),
					textLine("  health — Project health score"),
					textLine("  complexity — Code complexity"),
					textLine("  dependencies — Dependency graph"),
				]},
			],
			actions: [{ key: "r", label: "Run All" }, { key: "s", label: "Select Report" }],
		},
	},

	"review": {
		pattern: "dashboard",
		title: "Review",
		description: "Run E2E journeys and review pipeline status.",
		dashboard: {
			stats: [
				{ label: "Journeys", value: 5 },
				{ label: "Last Build", value: "passing", color: "#a6e3a1" },
			],
			sections: [
				{ title: "Review Pipeline", content: [
					textLine("  E2E journeys: 5 (skipped — not yet built)"),
					textLine("  Build status: passing"),
					textLine("  Lint: clean"),
				]},
			],
			actions: [{ key: "r", label: "Run Review" }, { key: "j", label: "Run Journeys" }],
		},
	},

	// ── List pages ─────────────────────────────────────────────────────────────

	"ai-tools": {
		pattern: "list",
		title: "Agents and AI Tools",
		description: "Browse and manage AI agents.",
		list: {
			items: [
				{ content: text("Software Architect [ai] architecture") },
				{ content: text("Product Owner [ai] product") },
				{ content: text("Tester [ai] quality") },
				{ content: text("UI Designer [human] design") },
				{ content: text("Tech Lead [ai] engineering") },
			],
			selected: 1,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Product Owner", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Manages product backlog and priorities", { dim: true }));
				el.appendChild(textLine("Domain: product"));
				el.appendChild(textLine("Type: ai"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }],
		},
	},

	"iterations": {
		pattern: "list",
		title: "Iterations",
		description: "Browse project iterations and track progress.",
		list: {
			items: [
				{ content: text("#5 Agent World [in-progress] 7/10") },
				{ content: text("#4 Visual Presence [done]") },
				{ content: text("#3 Agent Orchestration [done]") },
				{ content: text("#2 Agent Environment [done]") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("#5 Agent World", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Status: in-progress", { color: "#f9e2af" }));
				el.appendChild(textLine("Tasks: 7/10 complete"));
				el.appendChild(textLine("Started: 2026-03-14"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"resources": {
		pattern: "list",
		title: "Resources",
		description: "Team members and resource assignments.",
		list: {
			items: [
				{ content: text("Developer — Full-stack engineer") },
				{ content: text("Designer — UI/UX designer") },
				{ content: text("Tester — QA engineer") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Developer", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Role: Full-stack engineer", { dim: true }));
				el.appendChild(textLine("Allocation: 100%"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"timelog": {
		pattern: "list",
		title: "Time Log",
		description: "Track time entries across project tasks.",
		list: {
			items: [
				{ content: text("2026-03-16  4h  Storybook composition hierarchy") },
				{ content: text("2026-03-15  6h  Agent runner domain") },
				{ content: text("2026-03-14  3h  Session store refactor") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("2026-03-16", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Hours: 4"));
				el.appendChild(textLine("Task: Storybook composition hierarchy"));
				return el;
			})(),
			actions: [{ key: "n", label: "New Entry" }],
		},
	},

	"deliverables": {
		pattern: "list",
		title: "Deliverables",
		description: "Track project deliverables and completion status.",
		list: {
			items: [
				{ content: text("Storybook component library [in-progress]") },
				{ content: text("Agent runner [complete]") },
				{ content: text("ExcaliburJS RPG world [pending]") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Storybook component library", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Status: in-progress", { color: "#f9e2af" }));
				el.appendChild(textLine("Iteration: #5"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"raid": {
		pattern: "list",
		title: "RAID",
		description: "Risks, assumptions, issues, and dependencies.",
		list: {
			items: [
				{ content: text("[R] Agent process isolation may not work on Windows") },
				{ content: text("[R] ExcaliburJS canvas performance with many agents") },
				{ content: text("[A] Node.js v22+ available in target environments") },
				{ content: text("[D] Obsidian plugin API stable across versions") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("[Risk] Agent process isolation", { bold: true, color: "#f38ba8" }));
				el.appendChild(textLine("Agent process isolation may not work on Windows"));
				el.appendChild(textLine("Mitigation: test on Windows CI"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"capa": {
		pattern: "list",
		title: "CAPA",
		description: "Corrective and preventive actions.",
		list: {
			items: [
				{ content: text("CAPA-001  Fix branch coverage drop  [open]") },
				{ content: text("CAPA-002  Add E2E journey runner    [in-progress]") },
				{ content: text("CAPA-003  Resolve lint debt          [closed]") },
			],
			selected: 1,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("CAPA-002", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Add E2E journey runner"));
				el.appendChild(textLine("Status: in-progress", { color: "#f9e2af" }));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"lifecycle": {
		pattern: "list",
		title: "Lifecycle",
		description: "Project lifecycle phases and gate status.",
		list: {
			items: [
				{ content: text("Plan   [complete]") },
				{ content: text("Build  [in-progress]") },
				{ content: text("Review [pending]") },
				{ content: text("Release [pending]") },
			],
			selected: 1,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Build", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Status: in-progress", { color: "#f9e2af" }));
				el.appendChild(textLine("Gate: tests passing, lint clean"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "a", label: "Advance" }],
		},
	},

	"requirements": {
		pattern: "list",
		title: "Requirements",
		description: "Project requirements and acceptance criteria.",
		list: {
			items: [
				{ content: text("REQ-001  Sitemap drives all UI menus          [done]") },
				{ content: text("REQ-002  Zero runtime npm dependencies         [done]") },
				{ content: text("REQ-003  80% statement coverage gate           [done]") },
				{ content: text("REQ-004  Plugin as managed Flowti project      [open]") },
			],
			selected: 3,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("REQ-004", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Plugin as managed Flowti project"));
				el.appendChild(textLine("Status: open", { color: "#f9e2af" }));
				el.appendChild(textLine("Priority: high"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "n", label: "New" }],
		},
	},

	"event-catalog": {
		pattern: "list",
		title: "Event Catalog",
		description: "Browse all registered events across plugin domains.",
		list: {
			items: [
				{ content: text("session:started           domain: session") },
				{ content: text("session:ended             domain: session") },
				{ content: text("analytics:query:complete  domain: analytics") },
				{ content: text("journey:step:activated    domain: journey-builder") },
				{ content: text("agent:task:assigned       domain: agents") },
			],
			selected: 2,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("analytics:query:complete", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Domain: analytics"));
				el.appendChild(textLine("Payload: { queryId, result, duration }"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "f", label: "Filter" }],
		},
	},

	"components": {
		pattern: "list",
		title: "Components",
		description: "Browse UI components in the component library.",
		list: {
			items: [
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(document.createTextNode("terminal-view  "));
					el.appendChild(createBadge({ text: "primitive", color: "#89b4fa" }));
					return el;
				})() },
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(document.createTextNode("stat-card      "));
					el.appendChild(createBadge({ text: "primitive", color: "#89b4fa" }));
					return el;
				})() },
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(document.createTextNode("nav-card       "));
					el.appendChild(createBadge({ text: "composite", color: "#cba6f7" }));
					return el;
				})() },
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(document.createTextNode("page-pattern   "));
					el.appendChild(createBadge({ text: "pattern", color: "#f9e2af" }));
					return el;
				})() },
			],
			selected: 0,
			actions: [{ key: "Enter", label: "View Story" }],
		},
	},

	"workspaces": {
		pattern: "list",
		title: "Workspaces",
		description: "Manage git worktrees and workspace branches.",
		list: {
			items: [
				{ content: text("main                   branch: master") },
				{ content: text("feat/iter-5/storybook  branch: feat/iter-5/storybook-composition-hierarchy") },
			],
			selected: 1,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("feat/iter-5/storybook", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Branch: feat/iter-5/storybook-composition-hierarchy"));
				el.appendChild(textLine("Status: ahead by 6 commits"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Switch" }, { key: "n", label: "New Worktree" }],
		},
	},

	"onboarding-tour": {
		pattern: "list",
		title: "Onboarding Tour",
		description: "Interactive walkthrough of Flowti CLI features.",
		list: {
			items: [
				{ content: text("Step 1: Create your first project") },
				{ content: text("Step 2: Configure flowti.config.json") },
				{ content: text("Step 3: Run your first build") },
			],
			selected: 0,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Step 1: Create your first project", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Run: flowti init --name=MyProject"));
				el.appendChild(textLine("This creates a .flowti/config.json and starter structure."));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Start Step" }, { key: "n", label: "Next" }],
		},
	},

	"onboarding-checklist": {
		pattern: "list",
		title: "Onboarding Checklist",
		description: "Track setup completion for new projects.",
		list: {
			items: [
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(createBadge({ text: "done", color: "#a6e3a1" }));
					el.appendChild(document.createTextNode("  Create project config"));
					return el;
				})() },
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(createBadge({ text: "done", color: "#a6e3a1" }));
					el.appendChild(document.createTextNode("  Install dependencies"));
					return el;
				})() },
				{ content: (() => {
					const el = document.createElement("span");
					el.appendChild(createBadge({ text: "open", color: "#f9e2af" }));
					el.appendChild(document.createTextNode("  Configure health thresholds"));
					return el;
				})() },
			],
			selected: 2,
			detail: (() => {
				const el = document.createElement("div");
				el.appendChild(textLine("Configure health thresholds", { bold: true, color: "#89dceb" }));
				el.appendChild(textLine("Status: open", { color: "#f9e2af" }));
				el.appendChild(textLine("Edit: configs/flowti.config.json → health.thresholds"));
				return el;
			})(),
			actions: [{ key: "Enter", label: "Detail" }, { key: "c", label: "Complete" }],
		},
	},

};
