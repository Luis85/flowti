/**
 * help.ts — CLI help system (man-pages).
 */

import { RESET, BOLD, DIM, CYAN, GREEN, YELLOW } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";

// ── Help content ────────────────────────────────────────────────────

export const HELP: Record<string, string> = {
	main: `
  ${BOLD}FLOWTI CLI${RESET} — Project-centric developer tooling for the Flowti ecosystem.

  ${BOLD}USAGE${RESET}
    flowti                      Start interactive menu
    flowti help                 Show this help
    flowti help build           Show help for a specific section

  ${BOLD}WORKFLOW${RESET}
    Start Menu → Open/Create project → Project Detail Menu

  ${BOLD}PROJECT DETAIL MENU${RESET}
    ${CYAN}1) Make${RESET}         Scaffold in-project boilerplate (journey, component)
    ${CYAN}2) Build${RESET}        Build the project (generates Build Report)
    ${CYAN}3) Review${RESET}       E2E test sessions, vault management
    ${CYAN}4) Publish${RESET}      Gated pipeline: build → test → publish
    ${CYAN}5) Reports${RESET}      Run all reports, project status report
    ${CYAN}6) Npm Scripts${RESET}  Browse and run scripts from package.json
    ${CYAN}7) Capture Idea${RESET} Quick-capture an idea to vault inbox
    ${CYAN}8) Capture Note${RESET} Capture a typed note (Task, Bug, Note, ...)
    ${CYAN}d) Documentation${RESET} Generate reference docs (per-project generators)
    ${CYAN}k) Knowledgebase${RESET} Browse and search vault content (requires Obsidian CLI)
    ${CYAN}i) Info${RESET}         Project stats, version, config

  ${BOLD}CONFIGURATION${RESET}
    .flowti/config.json      Global CLI config (projects folder, capture, onboarding)
    flowti.config.json       Per-project config (tools, reports, docs, build commands)
    build-endpoints.json     Distribution endpoints (multi-vault deploy)
    manifest.json            Plugin metadata (id, version)

  ${BOLD}NON-INTERACTIVE COMMANDS${RESET}
    ${DIM}Most commands run against the selected project. Use --project=<name>
    to override, or select a project first with: flowti project${RESET}

    flowti build              Build the project
    flowti build:full         Full build pipeline
    flowti build:increment    CI pipeline (check → build → test → reports)
    flowti build:watch        Watch mode (add --reload for hot-reload)
    flowti build:distribute   Build + distribute to endpoints
    flowti test               Run tests
    flowti test:increment     Increment tests
    flowti test:e2e           E2E tests
    flowti review             Start E2E review session
    flowti publish            Build release
    flowti publish:all        Build + test pipeline
    flowti reports            Generate all reports
    flowti report:{id}        Generate a single report
    flowti dev:check          Lint + tsc
    flowti dev:lint           ESLint only
    flowti scaffold:new       Create a new Flowti project
    flowti scaffold:list      List available scaffold definitions
    flowti capture:idea --text="..." Capture an idea
    flowti capture:note --type=task --title="..." Capture a note
    flowti info               Show project info
    flowti help [section]     Show help

  ${BOLD}HELP${RESET}
    Press ${CYAN}?${RESET} in any menu for contextual help.
`,

	make: `
  ${BOLD}MAKE${RESET} — Scaffold in-project boilerplate from Flowti patterns.

  ${DIM}Note: To create a new project, use "Create Project" from the Start Menu
  or run: flowti scaffold:new${RESET}

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) New E2E Journey${RESET}
       Scaffolds a journey definition with test entry and canvas:
       - Journey definition (.journey file)
       - Test entry point
       - Journey canvas (for Obsidian)

       ${DIM}Prompts: journey name, slug, description${RESET}

    ${CYAN}2) Add Component${RESET}
       Scaffolds a component from a declarative JSON definition.
       8 component kinds available: component, layout, page, ui-component,
       system, container, c4-component, person.

       ${DIM}Generates: documentation, test file, definition JSON,
       and optionally a Storybook story file.${RESET}

  ${BOLD}CONFIGURATION${RESET}
    Available templates are configurable in flowti.config.json under "make":
      make.templates     Array of template IDs (default: ["journey", "component"])
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
  ${BOLD}REPORTS${RESET} — Generate project reports.

  Reports are written as markdown notes with YAML frontmatter.
  Each project configures its reports dir and generators in flowti.config.json.

  ${BOLD}PROJECT DETAIL MENU (key 5)${RESET}
    ${CYAN}1) Run All Reports${RESET}
       Runs the project's configured reports command and generates
       a Project Summary with risks, improvements, and state overview.
       ${DIM}→ Reads reports.allCommand or tools.reports from flowti.config.json${RESET}

    ${CYAN}2..n) Individual generators${RESET}
       Run a single report generator from reports.generators config.

  ${BOLD}NON-INTERACTIVE (plugin)${RESET}
    ${CYAN}1) Build all reports${RESET}
       ${DIM}→ npm run generate:reports (14 generators)${RESET}

    ${CYAN}2) Build selected report${RESET}
       Pick one by ID from flowti.config.json → reports.scripts.

    ${CYAN}3) Build audit report${RESET}
       Collects latest frontmatter from report categories
       and writes a consolidated audit note.

  ${BOLD}OUTPUT PATHS${RESET}
    Timestamped:  {reports.dir}/{type}/YYYY-MM-DD-*.md + .json
    Stable:       {reports.dir}/{type}/{Name}.md
    Reference:    docs/reference/{name}.md

  ${BOLD}CONFIGURATION${RESET}
    reports.dir         Output directory (default: reports)
    reports.allCommand  Command to generate all reports
    reports.scripts     Array of { id, label, script } generators
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
    flowti capture:idea --text "My idea here"
    flowti capture:note --type task --title "Fix login"

  ${BOLD}CONFIGURATION${RESET}
    Capture paths are configurable in .flowti/config.json:
      capture.idea            Idea folder (default: 00 - Connectivity/inbox)
      capture.task            Task folder
      capture.bug             Bug folder
      capture.note            Note folder
      capture.documentation   Documentation folder

    All paths are relative to the vault root.
`,

	knowledgebase: `
  ${BOLD}KNOWLEDGEBASE${RESET} — Browse and search vault content.

  ${BOLD}NAVIGATION${RESET}
    The knowledgebase provides an interactive file browser for the
    Obsidian vault. Folders and markdown files are listed with
    numbered entries — type a number to navigate into a folder
    or view a file.

  ${BOLD}COMMANDS${RESET}
    ${CYAN}1..n${RESET}  Select a folder or file by number
    ${CYAN}b${RESET}      Go back to parent folder
    ${CYAN}s${RESET}      Search vault content (filename + full-text)
    ${CYAN}?${RESET}      Show this help
    ${CYAN}q${RESET}      Return to project menu

  ${BOLD}SEARCH${RESET}
    Type ${CYAN}s${RESET} to enter search mode. Enter a query to search across
    all markdown files in the vault. Results show up to 20 matches.
    Select a result number to view the file.

    Search uses the Obsidian CLI when available, with a filesystem
    fallback that checks filenames and content (capped at 50 results).

  ${BOLD}REQUIREMENTS${RESET}
    - Obsidian CLI 1.12+ (${DIM}obsidian version${RESET})
    - An initialized vault (${DIM}.obsidian/ directory exists${RESET})

    If either requirement is missing, the knowledgebase menu item
    in the Project Detail Menu will be disabled.
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
		log(`\n  ${YELLOW}No help available for "${section}".${RESET}`);
		log(`  ${DIM}Available sections: ${Object.keys(HELP).join(", ")}${RESET}\n`);
		return;
	}
	log(content);
}

export const commands = {
	help: (flags: Record<string, string | boolean>, rawArgs: string[]) => {
		showHelp(Object.keys(flags)[0] ?? rawArgs?.[1] ?? "main");
	},
};
