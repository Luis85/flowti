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
		const section = this.container.createDiv({ cls: "ft-detail-section ft-detail-section-mt" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "filter");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Activity log filter", cls: "ft-heading ft-heading-sm ft-m-0" });

		section.createEl("p", {
			text: "Vault folders excluded from the session activity log globally (prefix match). Per-session filters can be set in each session workspace.",
			cls: "ft-text-sm ft-text-muted",
		});

		const filter = [...(settings.sessionActivityFilterGlobal ?? [])];

		// Existing entries
		for (const folder of filter) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
			row.createSpan({ text: folder, cls: "ft-text-sm ft-flex-1" });
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
		const addRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-form-row" });
		const addInput = addRow.createEl("input", { cls: "ft-input ft-flex-1" });
		addInput.type = "text";
		addInput.placeholder = "e.g. node_modules/";
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
		const section = this.container.createDiv({ cls: "ft-detail-section ft-detail-section-mt" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "star");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Custom session types", cls: "ft-heading ft-heading-sm ft-m-0" });

		section.createEl("p", {
			text: "Create custom session types with their own guiding questions, duration, and goals.",
			cls: "ft-text-sm ft-text-muted",
		});

		const customTypes = settings.customSessionTypes ?? {};

		// List existing
		for (const [key, cfg] of Object.entries(customTypes)) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
			const info = row.createDiv({ cls: "ft-flex-1" });
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
		const form = section.createDiv({ cls: "ft-pref-form" });

		let typeName = "";
		let typeLabel = "";
		let typeDuration = "25";
		let typeQuestions = "";

		const makeRow = (label: string): HTMLElement => {
			const row = form.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-form-row" });
			row.createSpan({ text: label, cls: "ft-text-sm ft-pref-label" });
			return row;
		};

		const keyRow = makeRow("Type key");
		const keyInput = keyRow.createEl("input", { cls: "ft-input ft-flex-1" });
		keyInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
	keyInput.placeholder = "e.g. sprint-review";
		keyInput.addEventListener("input", () => { typeName = keyInput.value; });

		const labelRow = makeRow("Display label");
		const labelInput = labelRow.createEl("input", { cls: "ft-input ft-flex-1" });
		labelInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		labelInput.placeholder = "e.g. Sprint Review";
		labelInput.addEventListener("input", () => { typeLabel = labelInput.value; });

		const durRow = makeRow("Duration (min)");
		const durInput = durRow.createEl("input", { cls: "ft-input ft-input-width-60" });
		durInput.type = "text";
		durInput.value = "25";
		durInput.addEventListener("input", () => { typeDuration = durInput.value; });

		const qRow = form.createDiv({ cls: "ft-pref-form-row" });
		qRow.createDiv({ text: "Guiding questions (one per line)", cls: "ft-text-sm" });
		const qTextarea = qRow.createEl("textarea", { cls: "ft-input ft-pref-textarea" });
		qTextarea.rows = 3;
		qTextarea.placeholder = "What is the goal?\nWhat do we need to decide?";
		qTextarea.addEventListener("input", () => { typeQuestions = qTextarea.value; });

		const btnRow = form.createDiv({ cls: "ft-pref-btn-row" });
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
		const section = this.container.createDiv({ cls: "ft-detail-section ft-detail-section-mt" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "file-output");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Custom output templates", cls: "ft-heading ft-heading-sm ft-m-0" });

		section.createEl("p", {
			text: "Create templates for generating output artifacts from completed sessions. Placeholders: {{title}}, {{date}}, {{type}}, {{duration}}, {{goals}}, {{decisions}}, {{artifacts}}, {{context}}, {{notes}}, {{overview}}.",
			cls: "ft-text-sm ft-text-muted",
		});

		const templates = settings.customOutputTemplates ?? [];

		// List existing
		for (let i = 0; i < templates.length; i++) {
			const tmpl = templates[i];
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
			const info = row.createDiv({ cls: "ft-flex-1" });
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
		const form = section.createDiv({ cls: "ft-pref-form" });

		let tmplTitle = "";
		let tmplDesc = "";
		let tmplSections = "";

		const makeRow = (label: string): HTMLElement => {
			const row = form.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-form-row" });
			row.createSpan({ text: label, cls: "ft-text-sm ft-pref-label" });
			return row;
		};

		const titleRow = makeRow("Template title");
		const titleInput = titleRow.createEl("input", { cls: "ft-input ft-flex-1" });
		titleInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		titleInput.placeholder = "e.g. Sprint Retro";
		titleInput.addEventListener("input", () => { tmplTitle = titleInput.value; });

		const descRow = makeRow("Description");
		const descInput = descRow.createEl("input", { cls: "ft-input ft-flex-1" });
		descInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		descInput.placeholder = "e.g. Sprint Retrospective Summary";
		descInput.addEventListener("input", () => { tmplDesc = descInput.value; });

		const sRow = form.createDiv({ cls: "ft-pref-form-row" });
		sRow.createDiv({ text: "Sections (one per line: Heading|{{placeholder}})", cls: "ft-text-sm" });
		const sTextarea = sRow.createEl("textarea", { cls: "ft-input ft-pref-textarea" });
		sTextarea.rows = 3;
		sTextarea.placeholder = "Summary|{{overview}}\nAction Items|{{decisions}}";
		sTextarea.addEventListener("input", () => { tmplSections = sTextarea.value; });

		const btnRow = form.createDiv({ cls: "ft-pref-btn-row" });
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
