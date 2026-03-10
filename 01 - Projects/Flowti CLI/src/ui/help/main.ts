import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpMain = `
  ${BOLD}FLOWTI CLI${RESET} — Project-centric developer tooling for the Flowti ecosystem.

  ${BOLD}USAGE${RESET}
    flowti                      Start interactive menu
    flowti help                 Show this help
    flowti help build           Show help for a specific section

  ${BOLD}WORKFLOW${RESET}
    Start Menu → Open/Create project → Project Detail Menu

  ${BOLD}PROJECT DETAIL MENU${RESET}
    ${CYAN}1) Capture Idea${RESET}  Quick-capture an idea to vault inbox
    ${CYAN}2) Capture Note${RESET}  Capture a typed note (Task, Bug, Note, ...)
    ${CYAN}3) Capture Bug${RESET}   Quick-capture a bug report
    ────────────────────────────────────────────
    ${CYAN}4) Make${RESET}          Scaffold in-project boilerplate (journey, component)
    ${CYAN}5) Build${RESET}         Build the project (generates Build Report)
    ${CYAN}6) Review${RESET}        E2E test sessions, vault management
    ${CYAN}7) Publish${RESET}       Gated pipeline: build → test → publish
    ${CYAN}8) Reporting${RESET}      Run all reports, project status report
    ────────────────────────────────────────────
    ${CYAN}d) Documentation${RESET} Generate reference docs (per-project generators)
    ${CYAN}k) Knowledgebase${RESET} Browse and search vault content (requires Obsidian CLI)
    ${CYAN}h) Health${RESET}        Project health dashboard (quality gate, tech debt, trends)
    ${CYAN}i) Info${RESET}          Project stats, version, config
    ────────────────────────────────────────────
    ${CYAN}e) Events${RESET}        Browse the event catalog
    ${CYAN}c) Components${RESET}    Browse and edit component definitions
    ${CYAN}g) Dependencies${RESET}  Project dependency graph
    ${CYAN}t) Dev Tools${RESET}     Type check, lint, reload, npm scripts, rebuild CLI

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
    flowti reports:diff       Compare latest vs previous report metrics
    flowti report:{id}        Generate a single report
    flowti dev:check          Lint + tsc
    flowti dev:lint           ESLint only
    flowti scaffold:new       Create a new Flowti project
    flowti scaffold:list      List available scaffold definitions
    flowti capture:idea --text="..." Capture an idea
    flowti capture:note --type=task --title="..." Capture a note
    flowti capture:bug --title="..." Capture a bug report
    flowti ai:run --tool=X    Execute an AI tool (with param substitution)
    flowti build:check        Check build freshness (source vs dist)
    flowti build:auto         Auto-build if stale
    flowti build:record       Record build manifest
    flowti reports:html       Export all reports to HTML
    flowti marketplace:export Export marketplace bundle
    flowti marketplace:import Import from remote registry
    flowti info               Show project info
    flowti help [section]     Show help

  ${BOLD}HELP${RESET}
    Press ${CYAN}?${RESET} in any menu for contextual help.
`;
