import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpKnowledgebase = `
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

  ${BOLD}REQUIREMENTS${RESET}
    - Obsidian CLI 1.12+ (${DIM}obsidian version${RESET})
    - An initialized vault (${DIM}.obsidian/ directory exists${RESET})
`;
