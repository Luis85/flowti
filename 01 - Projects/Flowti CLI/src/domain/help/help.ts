/**
 * help.ts — CLI help system (man-pages).
 */

import { RESET, BOLD, DIM, CYAN, GREEN, RED, YELLOW } from "../../infrastructure/ui.js";

// ── Help content ────────────────────────────────────────────────────

export const HELP: Record<string, string> = {
	main: `
  ${BOLD}FLOWTI CLI${RESET} — Developer tooling for the Flowti IBDE Obsidian plugin.

  ${BOLD}USAGE${RESET}
    npm run flowti              Start interactive menu
    npm run flowti help         Show this help
    npm run flowti help build   Show help for a specific section

  ${BOLD}MAIN MENU${RESET}
    ${CYAN}1) Make${RESET}       Scaffold new hub, plugin, or application from templates
    ${CYAN}2) Build${RESET}      Build the plugin (fast, full, watch, distribute)
    ${CYAN}3) Review${RESET}     E2E test sessions, vault management
    ${CYAN}4) Publish${RESET}    Gated pipeline: build → test → publish
    ${CYAN}5) Reports${RESET}    Generate vault reports (14 generators)
    ${CYAN}6) Dev Tools${RESET}  Plugin reload, console, frontmatter, test data
    ${CYAN}7) Info${RESET}       Project stats, version, config
    ${CYAN}8) Capture Idea${RESET}  Quick-capture an idea to vault inbox
    ${CYAN}9) Capture Note${RESET}  Capture a typed note (Task, Bug, Note, ...)
    ${CYAN}k) Knowledgebase${RESET} Browse and search vault content (requires Obsidian CLI)

  ${BOLD}NPM SCRIPTS (direct)${RESET}
    npm run build            Fast build (esbuild only, no reports)
    npm run build:dev        Watch mode with hot-reload
    npm run build:full       Flow tests → build → all reports
    npm run build:increment  Full CI: check → build → test → e2e → docs → distribute
    npm run test             Type check + lint + vitest
    npm run test:increment   Check + build + vitest with coverage
    npm run test:e2e         Build + flow tests + E2E suite
    npm run reports          Generate all 14 report notes
    npm run check            Lint + tsc (no tests)

  ${BOLD}CONFIGURATION${RESET}
    flowti.config.json       Report scripts, paths, build settings
    build-endpoints.json     Distribution endpoints (multi-vault deploy)
    manifest.json            Plugin metadata (id, version)

  ${BOLD}NON-INTERACTIVE COMMANDS${RESET}
    npm run flowti -- build              Fast build
    npm run flowti -- build:full         Flow tests + build + reports
    npm run flowti -- build:increment    Full CI pipeline
    npm run flowti -- build:watch        Watch mode (add --reload for hot-reload)
    npm run flowti -- build:distribute   Build + distribute to endpoints
    npm run flowti -- test               Type check + lint + vitest
    npm run flowti -- test:increment     Check + build + coverage
    npm run flowti -- test:e2e           Build + flow tests + E2E
    npm run flowti -- review             List E2E journeys
    npm run flowti -- publish            Build release
    npm run flowti -- publish:all        Increment + E2E + release
    npm run flowti -- reports            Generate all reports
    npm run flowti -- report:{id}        Generate a single report (e.g. report:test)
    npm run flowti -- dev:reload         Reload plugin in Obsidian
    npm run flowti -- dev:check          Lint + tsc
    npm run flowti -- dev:lint           ESLint only
    npm run flowti -- make:hub --name=X  Scaffold a new hub
    npm run flowti -- make:plugin --name=X  Scaffold a new plugin
    npm run flowti -- make:app --name=X  Scaffold a new DDD application
    npm run flowti -- capture:idea --text="..." Capture an idea
    npm run flowti -- capture:note --type=task --title="..." Capture a note
    npm run flowti -- info               Show project info
    npm run flowti -- help [section]     Show help

  ${BOLD}HELP${RESET}
    Press ${CYAN}?${RESET} in any menu for contextual help.
`,

	make: `
  ${BOLD}MAKE${RESET} — Scaffold boilerplate code from Flowti patterns.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) New Hub${RESET}
       Scaffolds a complete hub within the Flowti plugin:
       - UI view (BaseHubView subclass with tabs)
       - Domain layer (service stub, events, types)
       - Hub provider (HubDashboardProvider for cross-hub)
       - Test file (vitest + happy-dom setup)
       - CSS layer file
       - Feature PRD document
       - E2E journey stub

       ${DIM}Prompts: hub name, icon, hub type, initial tabs${RESET}

    ${CYAN}2) New Plugin${RESET}
       Scaffolds a standalone Obsidian plugin following Flowti patterns:
       - DDD folder structure (infrastructure, domain, ui)
       - EventBus backbone
       - BaseHubView base class
       - esbuild config with CSS pipeline
       - TypeScript, ESLint, Vitest setup
       - package.json with focused npm scripts

       ${DIM}Prompts: plugin name, plugin ID, author${RESET}

    ${CYAN}3) New Application${RESET}
       Scaffolds a full DDD Obsidian plugin project under 01 - Projects/:
       - Working EventBus (~80 LOC) with type-safe events
       - Infrastructure layer (events, errors, services)
       - Vitest + happy-dom + obsidian-stub test setup
       - Starter EventBus test (4 tests, passing on first run)
       - esbuild config with CSS pipeline
       - AppError base class with code + context
       - 17 files total, ready to npm install && npm run build

       ${DIM}Prompts: app name, app ID, author${RESET}

  ${BOLD}CONFIGURATION${RESET}
    Output paths are configurable in flowti.config.json under "make":
      make.hub.ui        UI source folder (default: src/ui)
      make.hub.domain    Domain source folder (default: src/domain)
      make.hub.tests     Test folder (default: tests/ui)
      make.hub.css       CSS folder (default: css)
      make.hub.docs      Feature docs folder (default: docs/features)
      make.hub.journeys  E2E journeys folder (default: tests/e2e/journeys)
      make.plugin.output Plugin output folder (default: ../)
`,

	build: `
  ${BOLD}BUILD${RESET} — Compile the Flowti plugin.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build (fast)${RESET}
       Runs esbuild in production mode. No tests, no reports.
       Concatenates CSS from css/ sources. Copies assets to output.
       ${DIM}→ node esbuild.config.mjs --production --no-reports${RESET}
       ${DIM}→ Typical time: ~2s${RESET}

    ${CYAN}2) Build increment${RESET}
       Full CI pipeline: lint → tsc → build → vitest (coverage) → E2E →
       TypeDoc → all reports → distribute to endpoints.
       ${DIM}→ npm run build:increment${RESET}
       ${DIM}→ Typical time: ~90s${RESET}

    ${CYAN}3) Build full${RESET}
       Flow tests gate the build, then generates all reports.
       ${DIM}→ npm run build:full${RESET}

    ${CYAN}4) Watch mode${RESET}
       Starts esbuild in watch mode. CSS changes auto-rebuild.
       Add --reload flag to hot-reload the plugin in Obsidian.
       ${DIM}→ node esbuild.config.mjs --watch [--reload]${RESET}

    ${CYAN}5) Distribute${RESET}
       Copies build artifacts to endpoints defined in build-endpoints.json.
       Each endpoint has a name, path, and optional clean flag.
       ${DIM}→ node esbuild.config.mjs --production --distribution${RESET}

  ${BOLD}ESBUILD FLAGS${RESET}
    --production     Minify + tree-shake (default for non-watch)
    --no-reports     Skip report generation after build
    --distribution   Copy to endpoint vaults
    --increment      Mark build as increment in reports
    --publish        Release mode (distribution + reports)
    --reload         Auto-reload plugin after each watch build
    --watch          Watch mode (inline sourcemaps, no minify)
`,

	review: `
  ${BOLD}REVIEW${RESET} — E2E testing and vault management.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Start test session${RESET}
       Opens the interactive E2E runner. Select journeys, configure
       step filters, run tests, view results.
       ${DIM}→ node scripts/run-e2e.mjs --list${RESET}

    ${CYAN}2) Build the increment${RESET}
       Full CI pipeline (same as Build → option 2).
       Must pass before publishing is unlocked.

    ${CYAN}3) Publish the increment${RESET}
       Gated — requires a successful increment build in this session.
       Runs the release pipeline.

    ${CYAN}4) Teardown test vault${RESET}
       Resets the E2E test vault to a fresh state:
       deletes content, purges ghost index, resets installer state.

    ${CYAN}5) Rebuild${RESET}
       Full teardown → re-run prerequisites → installer journey.

  ${BOLD}E2E JOURNEYS${RESET} (6 available)
    getting-started, component-library, canvas-session,
    tool-showcase, tool-reference, journey-builder

  ${BOLD}ENVIRONMENT VARIABLES${RESET}
    E2E_VAULT_DIR       Test vault path (default: ../flowti-e2e)
    E2E_JOURNEY         Comma-separated journey names
    E2E_RUN_INSTALLER   Set "true" to force installer
    E2E_STEPS           Step filter (e.g., journey-name:1,2,5)
`,

	publish: `
  ${BOLD}PUBLISH${RESET} — Gated release pipeline.

  The publish flow tracks pipeline state across three stages.
  Each stage must pass before the next unlocks.

  ${BOLD}PIPELINE${RESET}
    ${GREEN}✓${RESET}/${DIM}○${RESET} Build  →  ${GREEN}✓${RESET}/${DIM}○${RESET} Test  →  ${GREEN}✓${RESET}/${DIM}○${RESET} Publish

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build the increment${RESET}
       Runs the full increment build. On success, unlocks testing.

    ${CYAN}2) Test the increment (E2E)${RESET}
       Runs the full E2E suite. Requires a passing build.
       On success, unlocks publishing.

    ${CYAN}3) Publish the increment${RESET}
       Runs the release pipeline (check → build → test → docs → publish).
       Requires passing build AND test.

    ${CYAN}a) Run all${RESET}
       Runs build → test → publish in sequence.
       Stops on first failure.
`,

	reports: `
  ${BOLD}REPORTS${RESET} — Generate vault report notes.

  All reports are written as Obsidian notes with YAML frontmatter,
  making them queryable via Dataview or the Flowti query engine.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Build all reports${RESET}
       Runs all 14 report generators in sequence.
       ${DIM}→ npm run generate:reports${RESET}

    ${CYAN}2) Build selected report${RESET}
       Pick one report to generate. Reports are configured
       in flowti.config.json under reports.scripts.

    ${CYAN}3) Build audit report${RESET}
       Collects the latest frontmatter from all report categories
       and writes a consolidated audit note to docs/reports/audits/.

  ${BOLD}REPORT TYPES${RESET} (14)
    Test Report          Vitest results + perf summary
    Coverage Report      V8 line/branch/function coverage
    Build Report         Bundle size, duration, warnings
    Codebase Report      TypeDoc metrics (classes, LOC)
    Cycle Report         Cycle metadata + PBIs + test stats
    Trace Report         PRD → PBI → Test → Code linkage
    Command Reference    All plugin commands (~40)
    Event Catalog        All events (~443) by category
    Data Dictionary      18 entity types, 131 fields
    Performance Report   Startup/storage/query metrics
    Complexity Report    Cyclomatic complexity per file
    Tool Reference       30 E2E journey tools
    E2E Report           Journey results + screenshots
    CLI Reference        CLI commands, help sections, npm scripts

  ${BOLD}OUTPUT PATHS${RESET}
    Timestamped:  docs/reports/{type}/YYYY-MM-DD-*.md
    Stable:       docs/reference/{name}.md
    Audits:       docs/reports/audits/{name}.md
`,

	devtools: `
  ${BOLD}DEV TOOLS${RESET} — Developer utilities for the Obsidian plugin.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Reload plugin${RESET}
       Hot-reloads the flowti-ibde plugin via Obsidian CLI.
       Requires Obsidian 1.12+ running with CLI enabled.
       ${DIM}→ node scripts/cli-reload.mjs${RESET}

    ${CYAN}2) Dev console${RESET}
       Opens the Obsidian developer console stream.
       ${DIM}→ obsidian dev:console${RESET}

    ${CYAN}3) Dev errors${RESET}
       Opens the Obsidian error stream.
       ${DIM}→ obsidian dev:errors${RESET}

    ${CYAN}4) Fix frontmatter${RESET}
       Scans docs/ for missing type: and stage: fields (ADR-030).
       Runs in dry-run mode first — confirms before writing.
       ${DIM}→ node scripts/fix-frontmatter.mjs [--dry-run]${RESET}

    ${CYAN}5) Generate test data${RESET}
       Creates 8 CSV files for Analytics Hub dashboard testing.
       Supports --from, --to, --seed, --out flags.
       ${DIM}→ node scripts/generate-test-data.mjs${RESET}

    ${CYAN}6) Type check${RESET}
       Runs ESLint + TypeScript type-check (no tests).
       ${DIM}→ npm run check${RESET}

    ${CYAN}7) Lint${RESET}
       Runs ESLint on src/ only.
       ${DIM}→ npm run lint${RESET}

  ${BOLD}OBSIDIAN CLI${RESET} (requires Obsidian 1.12+)
    The Obsidian CLI provides vault management, plugin control,
    and code execution capabilities. The ObsidianCli class
    (src/infrastructure/cli/ObsidianCli.ts) wraps 20 methods:
    file ops, plugin management, eval, DOM queries, screenshots.
`,

	capture: `
  ${BOLD}CAPTURE${RESET} — Quick-capture ideas and notes into the vault.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Capture Idea${RESET}
       Prompts for an idea and creates a markdown note in the vault
       inbox folder. Filename is derived from the idea text (~60 chars).

    ${CYAN}2) Capture Note${RESET}
       Prompts for a type (Task, Bug, Note, Documentation, Idea)
       then a title. Creates a markdown note in the configured folder.

  ${BOLD}FILE FORMAT${RESET}
    Each captured file includes YAML frontmatter with type and date,
    followed by a heading and optional body text.

  ${BOLD}NON-INTERACTIVE${RESET}
    npm run flowti -- capture:idea --text "My idea here"
    npm run flowti -- capture:note --type task --title "Fix login"

  ${BOLD}CONFIGURATION${RESET}
    Capture paths are configurable in flowti-cli.config.json:
      capture.idea            Idea folder (default: 00 - Connectivity/inbox)
      capture.task            Task folder
      capture.bug             Bug folder
      capture.note            Note folder
      capture.documentation   Documentation folder

    All paths are relative to the vault root.
`,

	info: `
  ${BOLD}INFO${RESET} — Project information and diagnostics.

  Shows live project statistics gathered from:
    - manifest.json (plugin version, min Obsidian version)
    - package.json (dependencies, script count)
    - Source tree (file counts, test counts)
    - Git (branch, commit, status)
    - flowti.config.json (report scripts, paths)

  Use this to quickly check project health before starting work.
`,
};

export function showHelp(section?: string): void {
	const key = section?.toLowerCase() ?? "main";
	const content = HELP[key];
	if (!content) {
		console.log(`\n  ${YELLOW}No help available for "${section}".${RESET}`);
		console.log(`  ${DIM}Available sections: ${Object.keys(HELP).join(", ")}${RESET}\n`);
		return;
	}
	console.log(content);
}

export const commands = {
	help: (flags: Record<string, string | boolean>, rawArgs: string[]) => {
		showHelp(Object.keys(flags)[0] ?? rawArgs?.[1] ?? "main");
	},
};
