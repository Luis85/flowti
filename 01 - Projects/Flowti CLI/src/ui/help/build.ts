import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpBuild = `
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
`;
