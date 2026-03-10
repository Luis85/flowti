/**
 * make.ts — Thin facade re-exporting the Make domain's public API.
 *
 * The Make domain provides in-project scaffolding (hub, journey).
 * Project creation is handled by the Scaffold domain.
 *
 * Implementation lives in focused modules:
 *   - MakeService.ts     — template registry (pure domain)
 *   - makers.ts          — pure utility functions
 *   - templates/          — decomposed template generators
 *
 * Interactive menus live in src/ui/menus/:
 *   - make-menu.ts       — interactive Make menu
 *   - make-makers.ts     — interactive scaffolding functions
 */

export { menu } from "../../ui/menus/make-menu.js";
