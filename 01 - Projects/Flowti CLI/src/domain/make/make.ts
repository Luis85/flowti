/**
 * make.ts — Thin facade re-exporting the Make domain's public API.
 *
 * The Make domain provides in-project scaffolding (hub, journey).
 * Project creation is handled by the Scaffold domain.
 *
 * Implementation lives in focused modules:
 *   - MakeService.ts     — template registry & interactive menu
 *   - makers.ts          — interactive scaffolding functions
 *   - make-commands.ts   — non-interactive CLI commands
 *   - templates/          — decomposed template generators
 */

export { menu } from "./MakeService.js";
export { commands } from "./make-commands.js";
