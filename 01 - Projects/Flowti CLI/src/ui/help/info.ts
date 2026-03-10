import { RESET, BOLD } from "../../infrastructure/ui.js";

export const helpInfo = `
  ${BOLD}INFO${RESET} — Project information and diagnostics.

  Shows live project statistics gathered from:
    - manifest.json (plugin version, min Obsidian version)
    - package.json (dependencies, script count)
    - Source tree (file counts, test counts)
    - Git (branch, commit, status)
    - flowti.config.json (report scripts, paths)

  Use this to quickly check project health before starting work.
`;
