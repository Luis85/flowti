/**
 * make.ts — Thin facade re-exporting the Make domain's public API.
 *
 * Consumers import from this file for backward compatibility.
 * Implementation lives in focused modules:
 *   - MakeService.ts     — template registry & interactive menu
 *   - makers.ts          — interactive scaffolding functions
 *   - make-commands.ts   — non-interactive CLI commands
 *   - scaffolds.ts       — project scaffolding (used by project creation)
 *   - make-types.ts      — type definitions
 *   - templates/          — decomposed template generators
 */

export { menu } from "./MakeService.js";
export { commands } from "./make-commands.js";
export { PROJECT_TEMPLATES, PROJECT_TEMPLATE_IDS } from "./scaffolds.js";
export type { ProjectTemplateId, ProjectTemplate } from "./make-types.js";
