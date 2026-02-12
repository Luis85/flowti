/**
 * Default IBDE folder scaffold.
 *
 * Follows the PARA method as described in the Flowti vault documentation.
 * Parent folders are listed before children so sequential creation works.
 *
 * @see docs/ideas/Flowti IBDE - User Vault.md, lines 165-199
 */
export const DEFAULT_IBDE_FOLDERS: readonly string[] = [
  // Connectivity - data exchange with other systems
  "00 - Connectivity",
  "00 - Connectivity/input",
  "00 - Connectivity/inbox",
  "00 - Connectivity/imports",
  "00 - Connectivity/share",
  "00 - Connectivity/feedback",

  // Projects - big topics you contribute to
  "01 - Projects",

  // Areas - internalized domains you are responsible for
  "02 - Areas",

  // Resources - tools, documentation, procedures, domain model config
  "03 - Resources",
  "03 - Resources/Attachments",
  "03 - Resources/Bases",
  "03 - Resources/Daily Notes",
  "03 - Resources/Documentation",
  "03 - Resources/Documentation/Reference/Entities",
  "03 - Resources/Documentation/Reference/Actors",
  "03 - Resources/Documentation/Reference/Events",
  "03 - Resources/Documentation/How To",
  "03 - Resources/Documentation/Tutorials",
  "03 - Resources/Documentation/Guides",
  "03 - Resources/Templates",

  // Archives - old and obsolete notes
  "04 - Archive",

  // External data storage (events, logs, data records)
  "var",
  "var/data",
  "var/events",
  "var/reports",
] as const;
