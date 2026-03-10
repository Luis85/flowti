import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpReports = `
  ${BOLD}REPORTS${RESET} — Generate project reports.

  Reports are written as markdown notes with YAML frontmatter.
  Each project configures its reports dir and generators in flowti.config.json.

  ${BOLD}PROJECT DETAIL MENU (key 8)${RESET}
    ${CYAN}1) Run All Reports${RESET}
       Runs the project's configured reports command and generates
       a Project Summary with risks, improvements, and state overview.
       ${DIM}→ Reads reports.allCommand or tools.reports from flowti.config.json${RESET}

    ${CYAN}2..n) Individual generators${RESET}
       Run a single report generator from reports.generators config.

  ${BOLD}OUTPUT PATHS${RESET}
    Timestamped:  {reports.dir}/{type}/YYYY-MM-DD-*.md + .json
    Stable:       {reports.dir}/{type}/{Name}.md
    Reference:    docs/reference/{name}.md

  ${BOLD}CONFIGURATION${RESET}
    reports.dir         Output directory (default: reports)
    reports.allCommand  Command to generate all reports
    reports.scripts     Array of { id, label, script } generators
`;
