/**
 * NewSessionModal — multi-field modal for creating a new documentation session.
 * Extracted from modals.ts for max-lines compliance.
 */

import { App, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { SESSION_TYPE_CONFIGS } from "../domain/session/types";
import type { ContextBindingType, SessionTypeConfig } from "../domain/session/types";

export interface SessionTemplateSummary {
	id: string;
	name: string;
	type: string;
	durationMinutes: number;
	focusFile?: string;
	goals?: string[];
	tasks?: string[];
	decisions?: string[];
	contextBindings?: Array<{ path: string; type: ContextBindingType }>;
	notes?: string;
}

/**
 * A fuzzy-suggest picker that shows all vault files (no extension filter).
 */
class VaultFilePickerModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChooseFile: (filePath: string) => void;

	constructor(app: App, onChoose: (filePath: string) => void) {
		super(app);
		this.files = app.vault.getFiles().sort((a, b) => a.path.localeCompare(b.path));
		this.onChooseFile = onChoose;
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.onChooseFile(item.path);
	}
}

interface SessionFormState {
	title: string;
	type: string;
	duration: number;
	focusFile: string;
	featureName: string;
	goals: string[];
	extra: {
		tasks?: string[];
		decisions?: string[];
		contextBindings?: Array<{ path: string; type: ContextBindingType }>;
		notes?: string;
		featureName?: string;
	};
}

export class NewSessionModal extends Modal {
	private sessionTypes: ReadonlyArray<{ type: string; label: string; description: string }>;
	private templates: ReadonlyArray<SessionTemplateSummary>;
	private customConfigs: Record<string, SessionTypeConfig>;
	private prefill?: { title: string; type: string; durationMinutes: number; focusFile?: string; goals?: string[]; tasks?: string[]; decisions?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string; featureName?: string };
	private getFeatures?: () => Array<{ name: string }>;
	private onSubmit: (title: string, type: string, durationMinutes: number, focusFile: string | null, goals: string[], extra?: { tasks?: string[]; decisions?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string; featureName?: string }) => void;

	constructor(app: App, options: {
		sessionTypes: ReadonlyArray<{ type: string; label: string; description: string }>;
		templates?: ReadonlyArray<SessionTemplateSummary>;
		customConfigs?: Record<string, SessionTypeConfig>;
		getFeatures?: () => Array<{ name: string }>;
		prefill?: { title: string; type: string; durationMinutes: number; focusFile?: string; goals?: string[]; tasks?: string[]; decisions?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string; featureName?: string };
		onSubmit: (title: string, type: string, durationMinutes: number, focusFile: string | null, goals: string[], extra?: { tasks?: string[]; decisions?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string; featureName?: string }) => void;
	}) {
		super(app);
		this.sessionTypes = options.sessionTypes;
		this.templates = options.templates ?? [];
		this.customConfigs = options.customConfigs ?? {};
		this.getFeatures = options.getFeatures;
		this.prefill = options.prefill;
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "New session" });

		const form = this.initFormState();

		this.renderTemplateChooser(contentEl);
		const titleError = this.renderTitleField(contentEl, form);
		this.renderTypeDropdown(contentEl, form.type, () => form.title, () => form.focusFile, () => form.featureName, form.goals);
		this.renderDurationDropdown(contentEl, form.duration, (v) => { form.duration = v; });
		this.renderFocusFileSetting(contentEl, form.focusFile, (v) => { form.focusFile = v; });
		this.renderFeatureDropdown(contentEl, form.featureName, (v) => { form.featureName = v; });
		this.renderGoalsSection(contentEl, form.goals);
		this.renderSubmitButtons(contentEl, form, titleError);
	}

	private initFormState(): SessionFormState {
		const p = this.prefill;
		const defaultType = this.sessionTypes[0]?.type ?? "event-storming";
		return {
			title: p?.title ?? "",
			type: p?.type ?? defaultType,
			duration: p?.durationMinutes ?? 25,
			focusFile: p?.focusFile ?? "",
			featureName: p?.featureName ?? "",
			goals: [...(p?.goals ?? [])],
			extra: this.initExtraState(),
		};
	}

	private initExtraState(): SessionFormState["extra"] {
		const p = this.prefill;
		return {
			tasks: p?.tasks,
			decisions: p?.decisions,
			contextBindings: p?.contextBindings,
			notes: p?.notes,
		};
	}

	private renderTitleField(contentEl: HTMLElement, form: SessionFormState): HTMLElement {
		new Setting(contentEl)
			.setName("Title")
			.setDesc("A short name for this session")
			.addText((text) =>
				// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("e.g. Sprint 12 event storming")
					.setValue(form.title)
					.onChange((value) => {
						form.title = value;
						if (value.trim()) titleError.addClass("ft-hidden");
					})
			);

		const titleError = contentEl.createDiv({ cls: "ft-field-error ft-field-error-inline ft-hidden" });
		titleError.setText("Title is required");
		return titleError;
	}

	private renderSubmitButtons(contentEl: HTMLElement, form: SessionFormState, titleError: HTMLElement): void {
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Create").setCta().onClick(() => {
					const trimmed = form.title.trim();
					if (!trimmed) {
						titleError.removeClass("ft-hidden");
						return;
					}
					if (form.featureName) form.extra.featureName = form.featureName;
					this.onSubmit(trimmed, form.type, form.duration, form.focusFile.trim() || null, form.goals.filter((g) => g.trim()), form.extra);
					this.close();
				})
			);
	}

	private renderTemplateChooser(contentEl: HTMLElement): void {
		if (this.templates.length === 0) return;

		new Setting(contentEl)
			.setName("From template")
			.setDesc("Pre-fill from a saved template")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "-- none --");
				for (const t of this.templates) {
					dropdown.addOption(t.id, t.name);
				}
				dropdown.onChange((templateId) => {
					if (!templateId) return;
					const tmpl = this.templates.find((t) => t.id === templateId);
					if (tmpl) {
						this.close();
						new NewSessionModal(this.app, {
							sessionTypes: this.sessionTypes,
							templates: this.templates,
							customConfigs: this.customConfigs,
							getFeatures: this.getFeatures,
							prefill: { title: tmpl.name, type: tmpl.type, durationMinutes: tmpl.durationMinutes, focusFile: tmpl.focusFile, goals: tmpl.goals, tasks: tmpl.tasks, decisions: tmpl.decisions, contextBindings: tmpl.contextBindings, notes: tmpl.notes },
							onSubmit: this.onSubmit,
						}).open();
					}
				});
			});
	}

	private renderTypeDropdown(
		contentEl: HTMLElement,
		type: string,
		getTitle: () => string,
		getFocusFile: () => string,
		getFeatureName: () => string,
		goals: string[],
	): void {
		new Setting(contentEl)
			.setName("Type")
			.setDesc("The kind of documentation activity")
			.addDropdown((dropdown) => {
				for (const st of this.sessionTypes) {
					dropdown.addOption(st.type, st.label);
				}
				dropdown.setValue(type);
				dropdown.onChange((value) => {
					if (value === type) return;
					const cfg = this.customConfigs[value] ?? SESSION_TYPE_CONFIGS[value as keyof typeof SESSION_TYPE_CONFIGS];
					this.close();
					new NewSessionModal(this.app, {
						sessionTypes: this.sessionTypes,
						templates: this.templates,
						customConfigs: this.customConfigs,
						getFeatures: this.getFeatures,
						prefill: {
							title: getTitle(),
							type: value,
							durationMinutes: cfg?.defaultDuration ?? 25,
							focusFile: getFocusFile(),
							featureName: getFeatureName(),
							goals: cfg?.defaultGoals?.length ? [...cfg.defaultGoals] : goals,
						},
						onSubmit: this.onSubmit,
					}).open();
				});
			});
	}

	private renderDurationDropdown(contentEl: HTMLElement, duration: number, setDuration: (v: number) => void): void {
		new Setting(contentEl)
			.setName("Duration")
			.setDesc("Timer length in minutes")
			.addDropdown((dropdown) => {
				dropdown.addOption("0", "Unlimited (no timer)");
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				dropdown.addOption("25", "25 min (Pomodoro)");
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				dropdown.addOption("50", "50 min (Deep Work)");
				dropdown.addOption("15", "15 min (quick)");
				dropdown.addOption("45", "45 min");
				dropdown.addOption("60", "60 min");
				dropdown.setValue(String(duration));
				dropdown.onChange((value) => { setDuration(parseInt(value, 10)); });
			});
	}

	private renderFocusFileSetting(contentEl: HTMLElement, focusFile: string, setFocusFile: (v: string) => void): void {
		const focusSetting = new Setting(contentEl)
			.setName("Focus file")
			.setDesc("Optional file to work on during this session");

		focusSetting.addText((text) =>
			text.setPlaceholder("e.g. docs/my-feature.md")
				.setValue(focusFile)
				.onChange((value) => { setFocusFile(value); })
		);

		focusSetting.addExtraButton((btn) =>
			btn.setIcon("folder-open")
				.setTooltip("Browse vault files")
				.onClick(() => {
					new VaultFilePickerModal(this.app, (path) => {
						setFocusFile(path);
						const input = focusSetting.controlEl.querySelector("input");
						if (input) input.value = path;
					}).open();
				})
		);
	}

	private renderFeatureDropdown(contentEl: HTMLElement, featureName: string, setFeatureName: (v: string) => void): void {
		if (!this.getFeatures) return;
		const features = this.getFeatures();
		if (features.length === 0) return;

		new Setting(contentEl)
			.setName("Feature")
			.setDesc("Bind this session to a feature")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "-- none --");
				for (const f of features) {
					dropdown.addOption(f.name, f.name);
				}
				dropdown.setValue(featureName);
				dropdown.onChange((value) => { setFeatureName(value); });
			});
	}

	private renderGoalsSection(contentEl: HTMLElement, goals: string[]): void {
		const goalsContainer = contentEl.createDiv({ cls: "ft-goals-repeater ft-goals-container" });
		goalsContainer.createDiv({ cls: "setting-item-name", text: "Goals" });
		goalsContainer.createDiv({ cls: "setting-item-description ft-desc-setting-margin", text: "Press Enter to add a goal" });

		const goalsList = goalsContainer.createDiv({ cls: "ft-goals-list" });

		const renderGoalsList = (): void => {
			goalsList.empty();
			goals.forEach((text, i) => {
				const row = goalsList.createDiv({ cls: "ft-goal-row" });
				row.createEl("span", { text, cls: "ft-goal-label" });
				const removeBtn = row.createEl("button", { text: "\u00d7", cls: "clickable-icon ft-goal-remove-btn" });
				removeBtn.addEventListener("click", () => {
					goals.splice(i, 1);
					renderGoalsList();
				});
			});
		};
		renderGoalsList();

		const addRow = goalsContainer.createDiv({ cls: "ft-goal-add-row" });
		const goalInput = addRow.createEl("input", { type: "text", cls: "ft-goal-input" });
		goalInput.placeholder = "Add goal...";
		goalInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && goalInput.value.trim()) {
				goals.push(goalInput.value.trim());
				goalInput.value = "";
				renderGoalsList();
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
