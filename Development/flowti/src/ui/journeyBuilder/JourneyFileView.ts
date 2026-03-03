/**
 * JourneyFileView — TextFileView for .journey files.
 *
 * When Obsidian opens a .journey file, this view:
 *   1. Renders a summary card (name, description, step count)
 *   2. Opens the Journey Builder sidebar with the definition loaded
 *   3. Opens the companion .canvas file (if it exists)
 */
import { TextFileView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import { VIEW_TYPE_JOURNEY_BUILDER } from "./JourneyBuilderSidebar";

export const VIEW_TYPE_JOURNEY_FILE = "flowti-journey-file";

export class JourneyFileView extends TextFileView {
	private readonly eventBus: IEventBus;
	private readonly getJourneyFolder: () => string;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, getJourneyFolder: () => string) {
		super(leaf);
		this.eventBus = eventBus;
		this.getJourneyFolder = getJourneyFolder;
	}

	getViewType(): string {
		return VIEW_TYPE_JOURNEY_FILE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Journey Definition";
	}

	getIcon(): string {
		return "route";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		this.contentEl.empty();
		if (data) {
			this.renderContent();
			if (clear) {
				this.openJourneyBuilder(data);
			}
		}
	}

	clear(): void {
		this.contentEl.empty();
	}

	private renderContent(): void {
		this.contentEl.empty();
		this.contentEl.addClass("ft-jb-file-view");

		try {
			const parsed = JSON.parse(this.data) as Record<string, unknown>;
			const name = (parsed.journey as string) ?? "Unknown Journey";
			const description = (parsed.description as string) ?? "";
			const steps = Array.isArray(parsed.steps) ? parsed.steps : [];

			const card = this.contentEl.createDiv({ cls: "ft-jb-file-card" });

			const header = card.createDiv({ cls: "ft-jb-file-header" });
			const iconEl = header.createDiv({ cls: "ft-jb-file-icon" });
			setIcon(iconEl, "route");
			header.createEl("h2", { text: name, cls: "ft-jb-file-title" });

			if (description) {
				card.createEl("p", { text: description, cls: "ft-jb-file-desc" });
			}

			const info = card.createDiv({ cls: "ft-jb-file-info" });
			info.createSpan({ text: `${steps.length} step${steps.length !== 1 ? "s" : ""}`, cls: "ft-jb-file-badge" });
			if (parsed.startEvent) {
				info.createSpan({ text: `Start: ${parsed.startEvent as string}`, cls: "ft-jb-file-badge" });
			}
			if (parsed.endEvent) {
				info.createSpan({ text: `End: ${parsed.endEvent as string}`, cls: "ft-jb-file-badge" });
			}

			const actions = card.createDiv({ cls: "ft-jb-file-actions" });
			const canvasBtn = actions.createDiv({ cls: "ft-jb-file-action-btn" });
			canvasBtn.setAttribute("role", "button");
			canvasBtn.setAttribute("tabindex", "0");
			const canvasIcon = canvasBtn.createSpan({ cls: "ft-jb-file-action-icon" });
			setIcon(canvasIcon, "layout-dashboard");
			canvasBtn.createSpan({ text: "Open canvas" });
			canvasBtn.addEventListener("click", () => {
				const folder = this.getJourneyFolder();
				const canvasPath = `${folder}/${name}/${name}.canvas`;
				void this.app.workspace.openLinkText(canvasPath, "");
			});
		} catch {
			this.contentEl.createEl("pre", { text: this.data });
		}
	}

	private renderLoading(): HTMLElement {
		const container = this.contentEl.createDiv({ cls: "ft-jb-loading" });
		const spinner = container.createDiv({ cls: "ft-jb-loading-spinner" });
		setIcon(spinner, "loader");
		container.createDiv({ cls: "ft-jb-loading-text", text: "Opening canvas\u2026" });
		return container;
	}

	private openJourneyBuilder(json: string): void {
		// Activate the sidebar first
		this.activateSidebar();

		// Import the journey with a short delay to allow sidebar to initialize
		setTimeout(() => {
			void this.eventBus.emit("journey-builder.imported", { json });
		}, 300);

		// Open the companion canvas
		try {
			const parsed = JSON.parse(json) as Record<string, unknown>;
			const name = (parsed.journey as string) ?? "";
			if (name) {
				const loadingEl = this.renderLoading();
				const folder = this.getJourneyFolder();
				const canvasPath = `${folder}/${name}/${name}.canvas`;
				void this.app.workspace.openLinkText(canvasPath, "").then(
					() => loadingEl.remove(),
					() => {
						loadingEl.empty();
						loadingEl.createDiv({ cls: "ft-jb-loading-text", text: "Canvas not found" });
					},
				);
			}
		} catch {
			// JSON parse failed — skip canvas opening
		}
	}

	private activateSidebar(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOURNEY_BUILDER);
		if (leaves.length > 0) {
			void this.app.workspace.revealLeaf(leaves[0]);
			return;
		}
		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			void rightLeaf.setViewState({
				type: VIEW_TYPE_JOURNEY_BUILDER,
				active: true,
			});
		}
	}
}
