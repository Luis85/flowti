import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpReview = `
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
`;
