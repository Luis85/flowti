export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationError {
	path: string;
	message: string;
	severity: "error" | "warning";
}

const VALID_VIEW_KINDS = new Set(["hub", "panel", "leaf"]);
const VALID_MODAL_KINDS = new Set(["form", "confirm", "display"]);
const VALID_FIELD_TYPES = new Set(["text", "textarea", "select", "tags", "toggle", "number"]);

export function validatePluginSitemap(sitemap: unknown): ValidationResult {
	const errors: ValidationError[] = [];
	if (!sitemap || typeof sitemap !== "object") {
		errors.push({ path: "", message: "Sitemap must be a non-null object", severity: "error" });
		return { valid: false, errors };
	}
	const s = sitemap as Record<string, unknown>;
	if (s.version !== 2) errors.push({ path: "version", message: "Version must be 2", severity: "error" });
	validateViews(s, errors);
	validateCommands(s, errors);
	validateRibbon(s, errors);
	validateModals(s, errors);
	return { valid: !errors.some(e => e.severity === "error"), errors };
}

function validateViews(s: Record<string, unknown>, errors: ValidationError[]): void {
	if (!s.views || typeof s.views !== "object") return;
	const views = s.views as Record<string, Record<string, unknown>>;
	for (const [viewId, view] of Object.entries(views)) {
		if (!view.type || (typeof view.type === "string" && !view.type.trim())) {
			errors.push({ path: `views.${viewId}.type`, message: "View type is required", severity: "error" });
		}
		if (view.kind && !VALID_VIEW_KINDS.has(view.kind as string)) {
			errors.push({ path: `views.${viewId}.kind`, message: `Invalid view kind: ${view.kind}`, severity: "error" });
		}
		if (view.refreshEvents !== undefined) {
			if (!Array.isArray(view.refreshEvents) || !view.refreshEvents.every((e: unknown) => typeof e === "string" && (e as string).length > 0)) {
				errors.push({ path: `views.${viewId}.refreshEvents`, message: "refreshEvents must be an array of non-empty strings", severity: "error" });
			}
		}
		validateTabs(view, viewId, errors);
	}
}

function validateTabs(view: Record<string, unknown>, viewId: string, errors: ValidationError[]): void {
	if (!Array.isArray(view.tabs)) return;
	const tabIds = new Set<string>();
	for (let i = 0; i < view.tabs.length; i++) {
		const tab = view.tabs[i] as Record<string, unknown>;
		if (tabIds.has(tab.id as string)) {
			errors.push({ path: `views.${viewId}.tabs[${i}]`, message: `duplicate tab id: ${tab.id}`, severity: "error" });
		}
		tabIds.add(tab.id as string);
		if (!tab.handler && !tab.component) {
			errors.push({ path: `views.${viewId}.tabs[${i}]`, message: "Tab has neither handler nor component", severity: "warning" });
		}
	}
}

function validateCommands(s: Record<string, unknown>, errors: ValidationError[]): void {
	if (!Array.isArray(s.commands)) return;
	const commandIds = new Set<string>();
	for (let i = 0; i < s.commands.length; i++) {
		const cmd = s.commands[i] as Record<string, unknown>;
		if (commandIds.has(cmd.id as string)) {
			errors.push({ path: `commands[${i}]`, message: `Duplicate command id: ${cmd.id}`, severity: "error" });
		}
		commandIds.add(cmd.id as string);
		if (!cmd.handler || (typeof cmd.handler === "string" && !cmd.handler.trim())) {
			errors.push({ path: `commands[${i}].handler`, message: "Command handler is required", severity: "error" });
		}
	}
}

function validateRibbon(s: Record<string, unknown>, errors: ValidationError[]): void {
	if (!Array.isArray(s.ribbon)) return;
	for (let i = 0; i < s.ribbon.length; i++) {
		const r = s.ribbon[i] as Record<string, unknown>;
		if (!r.action || (typeof r.action === "string" && !r.action.trim())) {
			errors.push({ path: `ribbon[${i}].action`, message: "Ribbon action is required", severity: "error" });
		}
	}
}

function validateModals(s: Record<string, unknown>, errors: ValidationError[]): void {
	if (!s.modals || typeof s.modals !== "object") return;
	const modals = s.modals as Record<string, Record<string, unknown>>;
	for (const [modalId, modal] of Object.entries(modals)) {
		if (!VALID_MODAL_KINDS.has(modal.kind as string)) {
			errors.push({ path: `modals.${modalId}.kind`, message: `Invalid modal kind: ${modal.kind}`, severity: "error" });
		}
		validateModalFields(modal, modalId, errors);
	}
}

function validateModalFields(modal: Record<string, unknown>, modalId: string, errors: ValidationError[]): void {
	if (!Array.isArray(modal.fields)) return;
	for (let i = 0; i < modal.fields.length; i++) {
		const field = modal.fields[i] as Record<string, unknown>;
		if (!field.id || (typeof field.id === "string" && !field.id.trim())) {
			errors.push({ path: `modals.${modalId}.fields[${i}].id`, message: "Field id is required", severity: "error" });
		}
		if (!VALID_FIELD_TYPES.has(field.type as string)) {
			errors.push({ path: `modals.${modalId}.fields[${i}].type`, message: `Invalid field type: ${field.type}`, severity: "error" });
		}
		if (field.type === "select" && !Array.isArray(field.options)) {
			errors.push({ path: `modals.${modalId}.fields[${i}]`, message: "Select field should have options", severity: "warning" });
		}
	}
}
