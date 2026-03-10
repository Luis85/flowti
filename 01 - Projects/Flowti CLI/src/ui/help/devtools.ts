import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpDevtools = `
  ${BOLD}DEV TOOLS${RESET} — Developer utilities for the project.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Type Check + Lint${RESET}
       Runs ESLint + TypeScript type-check (no tests).
       ${DIM}→ npm run check (or npx tsc --noEmit)${RESET}

    ${CYAN}2) Lint Only${RESET}
       Runs ESLint on src/ only.
       ${DIM}→ npm run lint (or npx eslint src/)${RESET}

    ${CYAN}3) Reload Plugin${RESET}
       Hot-reloads the plugin via the CLI reload script.
       ${DIM}→ node scripts/cli-reload.mjs${RESET}

    ${CYAN}4) Dev Console${RESET}
       Opens the Obsidian developer console stream.
       Auto-enables debug mode if not already attached.
       ${DIM}→ obsidian dev:debug on + obsidian dev:console${RESET}

    ${CYAN}5) Debug Off${RESET}
       Disables the Obsidian debug mode (stops capturing console).
       ${DIM}→ obsidian dev:debug off${RESET}

    ${CYAN}6) Rebuild CLI${RESET}
       Rebuilds the Flowti CLI binary from source.
       ${DIM}→ Self-update: compiles and installs the latest CLI${RESET}
`;
