/**
 * Session preferences detail panel for the User Hub.
 *
 * Renders 3 sub-sections:
 * 1. Activity Log Filter — global folder exclusion list
 * 2. Custom Session Types — CRUD for user-defined types
 * 3. Custom Output Templates — CRUD for output artifact templates
 *
 * All mutations flow through EventBus commands → SettingsService.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";
import type { FlowtiSettings } from "../../domain/settings/settings";

export class UserHubSessionPreferences {
	constructor(
		private container: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	render(): void {
		this.container.empty();
		const settings = this.deps.getSettings();

		this.renderActivityFilter(settings);
		this.renderCustomSessionTypes(settings);
		this.renderCustomOutputTemplates(settings);
	}

	// ── Activity Filter ────────────────────────────────────────

	private renderActivityFilter(settings: FlowtiSettings): void {
		const section = this.container.createDiv({ cls: "ft-detail-section" });
		section.style.marginTop = "1rem";
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "filter");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Activity log filter", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		section.createEl("p", {
			text: "Vault folders excluded from the session activity log globally (prefix match). Per-session filters can be set in each session workspace.",
			cls: "ft-text-sm ft-text-muted",
		});

		const filter = [...(settings.sessionActivityFilterGlobal ?? [])];

		// Existing entries
		for (const folder of filter) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.25rem 0";
			row.createSpan({ text: folder, cls: "ft-text-sm" }).style.flex = "1";
			const removeBtn = row.createEl("button", { cls: "ft-btn-icon" });
			setIcon(removeBtn, "x");
			removeBtn.title = "Remove";
			removeBtn.addEventListener("click", () => {
				const updated = filter.filter((f) => f !== folder);
				void this.deps.eventBus.emit("settings.updateSessionActivityFilter", { filter: updated });
				setTimeout(() => this.deps.scheduleRender(), 50);
			});
		}

		// Add row
		const addRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		addRow.style.marginTop = "0.5rem";
		const addInput = addRow.createEl("input", { cls: "ft-input" });
		addInput.type = "text";
		addInput.placeholder = "e.g. node_modules/";
		addInput.style.flex = "1";
		const addBtn = addRow.createEl("button", { cls: "ft-btn-icon" });
		setIcon(addBtn, "plus");
		addBtn.title = "Add folder";
		addBtn.addEventListener("click", () => {
			const value = addInput.value.trim();
			if (value) {
				const updated = [...filter, value];
				void this.deps.eventBus.emit("settings.updateSessionActivityFilter", { filter: updated });
				setTimeout(() => this.deps.scheduleRender(), 50);
			}
		});
	}

	// ── Custom Session Types ───────────────────────────────────

	private renderCustomSessionTypes(settings: FlowtiSettings): void {
		const section = this.container.createDiv({ cls: "ft-detail-section" });
		section.style.marginTop = "1rem";
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "star");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Custom session types", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		section.createEl("p", {
			text: "Create custom session types with their own guiding questions, duration, and goals.",
			cls: "ft-text-sm ft-text-muted",
		});

		const customTypes = settings.customSessionTypes ?? {};

		// List existing
		for (const [key, cfg] of Object.entries(customTypes)) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.25rem 0";
			const info = row.createDiv();
			info.style.flex = "1";
			info.createDiv({ text: cfg.label || key, cls: "ft-text-sm" });
			info.createDiv({
				text: `${cfg.defaultDuration} min | ${cfg.guidingQuestions.length} questions`,
				cls: "ft-text-sm ft-text-muted",
			});
			const removeBtn = row.createEl("button", { cls: "ft-btn-icon" });
			setIcon(removeBtn, "x");
			removeBtn.title = "Remove";
			removeBtn.addEventListener("click", () => {
				const updated = { ...customTypes };
				delete updated[key];
				void this.deps.eventBus.emit("settings.updateCustomSessionTypes", { types: updated });
				setTimeout(() => this.deps.scheduleRender(), 50);
			});
		}

		// Add form
		const form = section.createDiv();
		form.style.marginTop = "0.75rem";
		form.style.borderTop = "1px solid var(--background-modifier-border)";
		form.style.paddingTop = "0.75rem";

		let typeName = "";
		let typeLabel = "";
		let typeDuration = "25";
		let typeQuestions = "";

		const makeRow = (label: string): HTMLElement => {
			const row = form.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginTop = "0.5rem";
			const lbl = row.createSpan({ text: label, cls: "ft-text-sm" });
			lbl.style.minWidth = "120px";
			return row;
		};

		const keyRow = makeRow("Type key");
		const keyInput = keyRow.createEl("input", { cls: "ft-input" });
		keyInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
	keyInput.placeholder = "e.g. sprint-review";
		keyInput.style.flex = "1";
		keyInput.addEventListener("input", () => { typeName = keyInput.value; });

		const labelRow = makeRow("Display label");
		const labelInput = labelRow.createEl("input", { cls: "ft-input" });
		labelInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		labelInput.placeholder = "e.g. Sprint Review";
		labelInput.style.flex = "1";
		labelInput.addEventListener("input", () => { typeLabel = labelInput.value; });

		const durRow = makeRow("Duration (min)");
		const durInput = durRow.createEl("input", { cls: "ft-input" });
		durInput.type = "text";
		durInput.value = "25";
		durInput.style.width = "60px";
		durInput.addEventListener("input", () => { typeDuration = durInput.value; });

		const qRow = form.createDiv();
		qRow.style.marginTop = "0.5rem";
		qRow.createDiv({ text: "Guiding questions (one per line)", cls: "ft-text-sm" });
		const qTextarea = qRow.createEl("textarea", { cls: "ft-input" });
		qTextarea.rows = 3;
		qTextarea.placeholder = "What is the goal?\nWhat do we need to decide?";
		qTextarea.style.width = "100%";
		qTextarea.style.marginTop = "0.25rem";
		qTextarea.addEventListener("input", () => { typeQuestions = qTextarea.value; });

		const btnRow = form.createDiv();
		btnRow.style.marginTop = "0.5rem";
		const addTypeBtn = btnRow.createEl("button", { text: "Add custom type", cls: "mod-cta" });
		addTypeBtn.addEventListener("click", () => {
			const key = typeName.trim().toLowerCase().replace(/\s+/g, "-");
			const label = typeLabel.trim();
			if (!key || !label) return;
			const dur = parseInt(typeDuration, 10) || 25;
			const questions = typeQuestions.split("\n").map((q) => q.trim()).filter(Boolean);
			const updated = {
				...customTypes,
				[key]: { type: key, label, icon: "star", guidingQuestions: questions, defaultDuration: dur, defaultGoals: [] as string[] },
			};
			void this.deps.eventBus.emit("settings.updateCustomSessionTypes", { types: updated });
			setTimeout(() => this.deps.scheduleRender(), 50);
		});
	}

	// ── Custom Output Templates ────────────────────────────────

	private renderCustomOutputTemplates(settings: FlowtiSettings): void {
		const section = this.container.createDiv({ cls: "ft-detail-section" });
		section.style.marginTop = "1rem";
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "file-output");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Custom output templates", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		section.createEl("p", {
			text: "Create templates for generating output artifacts from completed sessions. Placeholders: {{title}}, {{date}}, {{type}}, {{duration}}, {{goals}}, {{decisions}}, {{artifacts}}, {{context}}, {{notes}}, {{overview}}.",
			cls: "ft-text-sm ft-text-muted",
		});

		const templates = settings.customOutputTemplates ?? [];

		// List existing
		for (let i = 0; i < templates.length; i++) {
			const tmpl = templates[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.25rem 0";
			const info = row.createDiv();
			info.style.flex = "1";
			info.createDiv({ text: tmpl.title, cls: "ft-text-sm" });
			info.createDiv({
				text: `${tmpl.sections.length} sections`,
				cls: "ft-text-sm ft-text-muted",
			});
			const removeBtn = row.createEl("button", { cls: "ft-btn-icon" });
			setIcon(removeBtn, "x");
			removeBtn.title = "Remove";
			removeBtn.addEventListener("click", () => {
				const updated = templates.filter((_, idx) => idx !== i);
				void this.deps.eventBus.emit("settings.updateCustomOutputTemplates", { templates: updated });
				setTimeout(() => this.deps.scheduleRender(), 50);
			});
		}

		// Add form
		const form = section.createDiv();
		form.style.marginTop = "0.75rem";
		form.style.borderTop = "1px solid var(--background-modifier-border)";
		form.style.paddingTop = "0.75rem";

		let tmplTitle = "";
		let tmplDesc = "";
		let tmplSections = "";

		const makeRow = (label: string): HTMLElement => {
			const row = form.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.marginTop = "0.5rem";
			const lbl = row.createSpan({ text: label, cls: "ft-text-sm" });
			lbl.style.minWidth = "120px";
			return row;
		};

		const titleRow = makeRow("Template title");
		const titleInput = titleRow.createEl("input", { cls: "ft-input" });
		titleInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		titleInput.placeholder = "e.g. Sprint Retro";
		titleInput.style.flex = "1";
		titleInput.addEventListener("input", () => { tmplTitle = titleInput.value; });

		const descRow = makeRow("Description");
		const descInput = descRow.createEl("input", { cls: "ft-input" });
		descInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		descInput.placeholder = "e.g. Sprint Retrospective Summary";
		descInput.style.flex = "1";
		descInput.addEventListener("input", () => { tmplDesc = descInput.value; });

		const sRow = form.createDiv();
		sRow.style.marginTop = "0.5rem";
		sRow.createDiv({ text: "Sections (one per line: Heading|{{placeholder}})", cls: "ft-text-sm" });
		const sTextarea = sRow.createEl("textarea", { cls: "ft-input" });
		sTextarea.rows = 3;
		sTextarea.placeholder = "Summary|{{overview}}\nAction Items|{{decisions}}";
		sTextarea.style.width = "100%";
		sTextarea.style.marginTop = "0.25rem";
		sTextarea.addEventListener("input", () => { tmplSections = sTextarea.value; });

		const btnRow = form.createDiv();
		btnRow.style.marginTop = "0.5rem";
		const addTmplBtn = btnRow.createEl("button", { text: "Add output template", cls: "mod-cta" });
		addTmplBtn.addEventListener("click", () => {
			const title = tmplTitle.trim();
			if (!title) return;
			const sections = tmplSections.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					const [heading, placeholder] = line.split("|").map((s) => s.trim());
					return { heading: heading || "Section", placeholder: placeholder || "{{overview}}" };
				});
			const updated = [...templates, {
				type: "custom" as const,
				title,
				description: tmplDesc.trim() || title,
				sections,
			}];
			void this.deps.eventBus.emit("settings.updateCustomOutputTemplates", { templates: updated });
			setTimeout(() => this.deps.scheduleRender(), 50);
		});
	}
}
