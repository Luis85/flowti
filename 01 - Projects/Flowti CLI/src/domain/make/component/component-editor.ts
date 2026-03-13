/**
 * component-editor.ts — Read and edit component instance definitions.
 *
 * The instance JSON (e.g. components/button/button.json) is the source of truth
 * for a component's metadata. This module provides pure functions for reading,
 * displaying, and modifying those definitions.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";

export type ComponentEditorDeps = Pick<CliDeps, "disk" | "paths">;

// ── Instance definition shape (on-disk JSON) ────────────────────────

export interface ComponentInstanceChild {
	name: string;
	slot?: string;
	optional?: boolean;
}

export interface InstanceRelationship {
	target: string;
	type: "uses" | "calls" | "depends-on" | "sends-data-to" | "receives-data-from";
	description?: string;
	technology?: string;
}

export interface ComponentInstanceStore {
	name: string;
	technology?: string;
	description?: string;
}

export interface ComponentInstance {
	name: string;
	id: string;
	type: string;
	status: string;
	description?: string;
	owner?: string;
	technology?: string;
	containedBy?: string;
	domain?: string;
	icon?: string;
	heroImage?: string;
	properties?: Record<string, unknown>;
	actions?: string[];
	variants?: Record<string, Record<string, unknown>>;
	states?: Record<string, Record<string, unknown>>;
	children?: ComponentInstanceChild[];
	stores?: ComponentInstanceStore[];
	requirements?: string[];
	features?: string[];
	relationships?: InstanceRelationship[];
	priority?: string;
	version?: string;
	deprecated?: string;
	role?: string;
	arc42Level?: string;
	[key: string]: unknown;
}

// ── Read ─────────────────────────────────────────────────────────────

export function readComponentInstance(
	projectPath: string,
	componentName: string,
	deps: ComponentEditorDeps,
	domain?: string,
): ComponentInstance | null {
	const jsonPath = domain
		? deps.paths.join(projectPath, "components", domain, componentName, `${componentName}.json`)
		: deps.paths.join(projectPath, "components", componentName, `${componentName}.json`);
	if (!deps.disk.existsSync(jsonPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8"));
	} catch {
		return null;
	}
}

// ── Write ────────────────────────────────────────────────────────────

export function writeComponentInstance(
	projectPath: string,
	componentName: string,
	instance: ComponentInstance,
	deps: ComponentEditorDeps,
	domain?: string,
): void {
	const jsonPath = domain
		? deps.paths.join(projectPath, "components", domain, componentName, `${componentName}.json`)
		: deps.paths.join(projectPath, "components", componentName, `${componentName}.json`);
	deps.disk.writeFileSync(jsonPath, JSON.stringify(instance, null, "\t") + "\n", "utf-8");
}

// ── Field editing ────────────────────────────────────────────────────

export const EDITABLE_FIELDS = ["name", "description", "status", "owner", "technology", "containedBy", "domain", "icon", "priority", "version", "deprecated", "role", "arc42Level"] as const;
export type EditableField = typeof EDITABLE_FIELDS[number];

export function getEditableFields(): readonly string[] {
	return EDITABLE_FIELDS;
}

export function setField(instance: ComponentInstance, field: EditableField, value: string): void {
	if (value === "") {
		delete instance[field];
	} else {
		(instance as Record<string, unknown>)[field] = value;
	}
}

// ── Property editing ─────────────────────────────────────────────────

export function addProperty(instance: ComponentInstance, key: string, defaultValue: unknown): void {
	if (!instance.properties) instance.properties = {};
	instance.properties[key] = defaultValue;
}

export function removeProperty(instance: ComponentInstance, key: string): void {
	if (!instance.properties) return;
	delete instance.properties[key];
	if (Object.keys(instance.properties).length === 0) delete instance.properties;
}

// ── Action editing ───────────────────────────────────────────────────

export function addAction(instance: ComponentInstance, actionName: string): void {
	if (!instance.actions) instance.actions = [];
	if (!instance.actions.includes(actionName)) instance.actions.push(actionName);
}

export function removeAction(instance: ComponentInstance, actionName: string): void {
	if (!instance.actions) return;
	instance.actions = instance.actions.filter((a) => a !== actionName);
	if (instance.actions.length === 0) delete instance.actions;
}

// ── Children editing ─────────────────────────────────────────────────

export function addChild(instance: ComponentInstance, child: ComponentInstanceChild): void {
	if (!instance.children) instance.children = [];
	if (!instance.children.some((c) => c.name === child.name)) instance.children.push(child);
}

export function removeChild(instance: ComponentInstance, childName: string): void {
	if (!instance.children) return;
	instance.children = instance.children.filter((c) => c.name !== childName);
	if (instance.children.length === 0) delete instance.children;
}

// ── Store editing ────────────────────────────────────────────────────

export function addStore(instance: ComponentInstance, store: ComponentInstanceStore): void {
	if (!instance.stores) instance.stores = [];
	if (!instance.stores.some((s) => s.name === store.name)) instance.stores.push(store);
}

export function removeStore(instance: ComponentInstance, storeName: string): void {
	if (!instance.stores) return;
	instance.stores = instance.stores.filter((s) => s.name !== storeName);
	if (instance.stores.length === 0) delete instance.stores;
}

// ── Requirement editing ─────────────────────────────────────────────

export function addRequirement(instance: ComponentInstance, requirementId: string): void {
	if (!instance.requirements) instance.requirements = [];
	if (!instance.requirements.includes(requirementId)) instance.requirements.push(requirementId);
}

export function removeRequirement(instance: ComponentInstance, requirementId: string): void {
	if (!instance.requirements) return;
	instance.requirements = instance.requirements.filter((r) => r !== requirementId);
	if (instance.requirements.length === 0) delete instance.requirements;
}

// ── Feature editing ─────────────────────────────────────────────────

export function addFeature(instance: ComponentInstance, feature: string): void {
	if (!instance.features) instance.features = [];
	if (!instance.features.includes(feature)) instance.features.push(feature);
}

export function removeFeature(instance: ComponentInstance, feature: string): void {
	if (!instance.features) return;
	instance.features = instance.features.filter((f) => f !== feature);
	if (instance.features.length === 0) delete instance.features;
}

// ── Relationship editing ────────────────────────────────────────────

export function addRelationship(instance: ComponentInstance, rel: InstanceRelationship): void {
	if (!instance.relationships) instance.relationships = [];
	if (!instance.relationships.some((r: InstanceRelationship) => r.target === rel.target && r.type === rel.type)) {
		instance.relationships.push(rel);
	}
}

export function removeRelationship(instance: ComponentInstance, target: string, type?: string): void {
	if (!instance.relationships) return;
	instance.relationships = (instance.relationships as InstanceRelationship[]).filter(
		(r) => !(r.target === target && (type === undefined || r.type === type)),
	);
	if (instance.relationships.length === 0) delete instance.relationships;
}
