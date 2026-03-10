import { RESET, BOLD, DIM, CYAN } from "../../infrastructure/ui.js";

export const helpMake = `
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
`;
