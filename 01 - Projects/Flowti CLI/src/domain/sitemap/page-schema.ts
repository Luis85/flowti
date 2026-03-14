/**
 * page-schema.ts — Validation for v2 unified sitemap format.
 *
 * Pure functions that validate raw JSON against the UnifiedSitemap shape.
 * Returns errors (fatal) and warnings (non-fatal) for clear diagnostics.
 */

import { PAGE_KINDS } from "./unified-page.js";
import type { PageKind, ActionType } from "./unified-page.js";
import {
	validateChildren, validateDataSources, validateValidationRules,
	validateEventDeclarations, validateProperties, validateVariants,
	validateStates, validateFields,
} from "./page-schema-parts.js";

export interface PageValidationResult {
	errors: string[];
	warnings: string[];
}

const VALID_ACTION_TYPES: ActionType[] = ["navigate", "handler", "command", "signal", "form"];
const VALID_SIGNALS = ["back", "quit", "start"];
const VALID_CONTEXTS = ["project"];
const VALID_STATUSES = ["draft", "active", "deprecated"];

// ── Root validation ─────────────────────────────────────────────────

/** Validate a raw object as a UnifiedSitemap. */
export function validateUnifiedSitemap(raw: unknown): PageValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!raw || typeof raw !== "object") {
		return { errors: ["Sitemap must be a non-null object."], warnings };
	}

	const obj = raw as Record<string, unknown>;

	if (obj.version !== 2) {
		errors.push(`Expected version 2, got ${JSON.stringify(obj.version)}.`);
	}

	if (!obj.pages || typeof obj.pages !== "object") {
		errors.push('"pages" must be a non-empty object.');
		return { errors, warnings };
	}

	const pages = obj.pages as Record<string, unknown>;
	const pageIds = new Set(Object.keys(pages));

	for (const [id, page] of Object.entries(pages)) {
		validatePage(id, page, pageIds, errors, warnings);
	}

	return { errors, warnings };
}

// ── Page validation ─────────────────────────────────────────────────

function validatePage(
	id: string, raw: unknown, allPageIds: Set<string>,
	errors: string[], warnings: string[],
): void {
	const prefix = `pages.${id}`;

	if (!raw || typeof raw !== "object") {
		errors.push(`${prefix}: must be an object.`);
		return;
	}

	const page = raw as Record<string, unknown>;

	validatePageIdentity(prefix, page, errors, warnings);
	validatePageNavigation(prefix, page, allPageIds, errors, warnings);
	validatePageActions(prefix, page, allPageIds, errors, warnings);
	validatePageContent(prefix, page, allPageIds, errors, warnings);
	validatePageForm(prefix, page, errors, warnings);
	validatePageMetadata(prefix, page, errors, warnings);
}

function validatePageIdentity(
	prefix: string, page: Record<string, unknown>,
	errors: string[], warnings: string[],
): void {
	validatePageKind(prefix, page, errors);
	validateStringField(prefix, page, "label", errors);
	if (typeof page.description !== "string") {
		errors.push(`${prefix}: missing "description" (must be a string).`);
	}
	validateOptionalString(prefix, page, "icon", warnings);
	validateOptionalString(prefix, page, "domain", warnings);
	if (page.status !== undefined && !VALID_STATUSES.includes(page.status as string)) {
		warnings.push(`${prefix}: "status" must be one of: ${VALID_STATUSES.join(", ")}.`);
	}
}

function validatePageKind(prefix: string, page: Record<string, unknown>, errors: string[]): void {
	if (!page.kind || typeof page.kind !== "string") {
		errors.push(`${prefix}: missing or invalid "kind".`);
	} else if (!PAGE_KINDS.includes(page.kind as PageKind)) {
		errors.push(`${prefix}: unknown kind "${page.kind}". Valid: ${PAGE_KINDS.join(", ")}.`);
	}
}

function validateStringField(prefix: string, page: Record<string, unknown>, field: string, errors: string[]): void {
	if (typeof page[field] !== "string" || (page[field] as string).length === 0) {
		errors.push(`${prefix}: missing or empty "${field}".`);
	}
}

function validateOptionalString(prefix: string, page: Record<string, unknown>, field: string, warnings: string[]): void {
	if (page[field] !== undefined && typeof page[field] !== "string") {
		warnings.push(`${prefix}: "${field}" must be a string.`);
	}
}

function validatePageNavigation(
	prefix: string, page: Record<string, unknown>,
	allPageIds: Set<string>, errors: string[], warnings: string[],
): void {
	if (page.parent !== undefined) {
		if (typeof page.parent !== "string") {
			errors.push(`${prefix}: "parent" must be a string.`);
		} else if (!allPageIds.has(page.parent)) {
			warnings.push(`${prefix}: parent "${page.parent}" does not reference a known page.`);
		}
	}

	if (page.context !== undefined) {
		if (!Array.isArray(page.context)) {
			errors.push(`${prefix}: "context" must be an array.`);
		} else {
			for (const ctx of page.context as unknown[]) {
				if (!VALID_CONTEXTS.includes(ctx as string)) {
					errors.push(`${prefix}: invalid context "${ctx}". Valid: ${VALID_CONTEXTS.join(", ")}.`);
				}
			}
		}
	}
}

function validatePageActions(
	prefix: string, page: Record<string, unknown>,
	allPageIds: Set<string>, errors: string[], warnings: string[],
): void {
	if (!Array.isArray(page.actions)) {
		errors.push(`${prefix}: "actions" must be an array.`);
	} else {
		validateActions(prefix, page.actions as unknown[], allPageIds, errors, warnings);
	}
}

function validatePageContent(
	prefix: string, page: Record<string, unknown>,
	allPageIds: Set<string>, errors: string[], warnings: string[],
): void {
	if (page.children !== undefined) {
		if (!Array.isArray(page.children)) {
			errors.push(`${prefix}: "children" must be an array.`);
		} else {
			validateChildren(prefix, page.children as unknown[], allPageIds, warnings);
		}
	}

	if (page.dataSources !== undefined) {
		if (!Array.isArray(page.dataSources)) {
			errors.push(`${prefix}: "dataSources" must be an array.`);
		} else {
			validateDataSources(prefix, page.dataSources as unknown[], errors);
		}
	}
}

function validatePageForm(
	prefix: string, page: Record<string, unknown>,
	errors: string[], warnings: string[],
): void {
	if (page.kind === "form") {
		if (!Array.isArray(page.fields) || page.fields.length === 0) {
			errors.push(`${prefix}: form pages must have a non-empty "fields" array.`);
		} else {
			validateFields(prefix, page.fields as unknown[], errors, warnings);
		}
	}

	if (page.fields !== undefined && page.kind !== "form") {
		warnings.push(`${prefix}: "fields" defined but kind is not "form".`);
	}

	if (page.validation !== undefined) {
		if (!Array.isArray(page.validation)) {
			errors.push(`${prefix}: "validation" must be an array.`);
		} else {
			validateValidationRules(prefix, page.validation as unknown[], errors);
		}
	}
}

function validatePageMetadata(
	prefix: string, page: Record<string, unknown>,
	errors: string[], warnings: string[],
): void {
	if (page.emits !== undefined) validateEventDeclarations(prefix, "emits", page.emits, errors);
	if (page.accepts !== undefined) validateEventDeclarations(prefix, "accepts", page.accepts, errors);
	validatePageComponentMeta(prefix, page, warnings);
}

function validatePageComponentMeta(
	prefix: string, page: Record<string, unknown>,
	warnings: string[],
): void {
	if (page.properties !== undefined) validateProperties(prefix, page.properties, warnings);
	if (page.variants !== undefined) validateVariants(prefix, page.variants, warnings);
	if (page.states !== undefined) validateStates(prefix, page.states, warnings);

	for (const hook of ["onBeforeRender", "onNavigate", "onLeave"] as const) {
		if (page[hook] !== undefined && typeof page[hook] !== "string") {
			warnings.push(`${prefix}: "${hook}" must be a string.`);
		}
	}

	if (page.configPath !== undefined && typeof page.configPath !== "string") {
		warnings.push(`${prefix}: "configPath" must be a string.`);
	}
}

// ── Action validation ───────────────────────────────────────────────

function validateActions(
	prefix: string, actions: unknown[], allPageIds: Set<string>,
	errors: string[], warnings: string[],
): void {
	const keys = new Set<string>();

	for (let i = 0; i < actions.length; i++) {
		const raw = actions[i];
		const ap = `${prefix}.actions[${i}]`;

		if (!raw || typeof raw !== "object") {
			errors.push(`${ap}: must be an object.`);
			continue;
		}

		const action = raw as Record<string, unknown>;
		validateSingleAction(ap, action, allPageIds, keys, errors, warnings);
	}
}

function validateSingleAction(
	ap: string, action: Record<string, unknown>,
	allPageIds: Set<string>, keys: Set<string>,
	errors: string[], warnings: string[],
): void {
	validateStringField(ap, action, "name", errors);
	validateStringField(ap, action, "label", errors);

	if (!VALID_ACTION_TYPES.includes(action.type as ActionType)) {
		errors.push(`${ap}: "type" must be one of: ${VALID_ACTION_TYPES.join(", ")}.`);
	}

	validateActionTarget(ap, action, allPageIds, errors, warnings);
	validateActionKey(ap, action, keys, warnings);
}

function validateActionTarget(
	ap: string, action: Record<string, unknown>,
	allPageIds: Set<string>, errors: string[], warnings: string[],
): void {
	if (action.target === undefined) return;

	if (action.type === "navigate" || action.type === "form") {
		if (typeof action.target !== "string") {
			errors.push(`${ap}: "target" must be a string.`);
		} else if (!allPageIds.has(action.target)) {
			warnings.push(`${ap}: ${action.type} target "${action.target}" does not reference a known page.`);
		}
	}

	if (action.type === "signal" && !VALID_SIGNALS.includes(action.target as string)) {
		errors.push(`${ap}: signal target must be one of: ${VALID_SIGNALS.join(", ")}.`);
	}
}

function validateActionKey(
	ap: string, action: Record<string, unknown>,
	keys: Set<string>, warnings: string[],
): void {
	if (action.key === undefined) return;

	if (typeof action.key !== "string") {
		warnings.push(`${ap}: "key" must be a string.`);
		return;
	}

	const lower = action.key.toLowerCase();
	if (keys.has(lower)) {
		warnings.push(`${ap}: duplicate key "${lower}".`);
	}
	keys.add(lower);
}
