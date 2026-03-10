import { RESET, BOLD, DIM, CYAN, GREEN } from "../../infrastructure/ui.js";

export const helpPublish = `
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
`;
