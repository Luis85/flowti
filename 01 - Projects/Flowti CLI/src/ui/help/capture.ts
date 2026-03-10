import { RESET, BOLD, CYAN } from "../../infrastructure/ui.js";

export const helpCapture = `
  ${BOLD}CAPTURE${RESET} — Quick-capture ideas and notes into the vault.

  ${BOLD}OPTIONS${RESET}
    ${CYAN}1) Capture Idea${RESET}
       Prompts for an idea and creates a markdown note in the vault
       inbox folder. Filename is derived from the idea text (~60 chars).

    ${CYAN}2) Capture Note${RESET}
       Prompts for a type (Task, Bug, Note, Documentation, Idea)
       then a title. Creates a markdown note in the configured folder.

    ${CYAN}3) Capture Bug${RESET}
       Prompts for a bug title and optional description.
       Creates a bug report in the configured bug folder.

  ${BOLD}FILE FORMAT${RESET}
    Each captured file includes YAML frontmatter with type and date,
    followed by a heading and optional body text.

  ${BOLD}NON-INTERACTIVE${RESET}
    flowti capture:idea --text "My idea here"
    flowti capture:note --type task --title "Fix login"
    flowti capture:bug --title "Login fails on empty password"

  ${BOLD}CONFIGURATION${RESET}
    Capture paths are configurable in .flowti/config.json:
      capture.idea            Idea folder (default: 00 - Connectivity/inbox)
      capture.task            Task folder
      capture.bug             Bug folder
      capture.note            Note folder
      capture.documentation   Documentation folder

    All paths are relative to the vault root.
`;
