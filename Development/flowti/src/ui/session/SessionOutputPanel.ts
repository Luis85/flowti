import { setIcon } from "obsidian";
import type { SessionPanelDeps } from "./types";
import type { SessionOutputArtifact } from "../../domain/session/types";

/**
 * Panel that lists generated output artifacts and provides
 * a "Generate Output" button for completed/archived sessions.
 */
export class SessionOutputPanel {
	private listEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;
	private onGenerate: () => void;

	constructor(private container: HTMLElement, deps: SessionPanelDeps, onGenerate: () => void) {
		this.deps = deps;
		this.onGenerate = onGenerate;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-outputs ft-section" });

		const headerRow = section.createDiv({ cls: "ft-panel-header-row" });

		const labelRow = headerRow.createDiv({ cls: "ft-panel-label-row" });
		labelRow.createEl("strong", { text: "Output artifacts" });
		this.countEl = labelRow.createEl("span", {
			text: `(${session.outputArtifacts.length})`,
			cls: "ft-text-muted ft-text-sm ft-panel-count",
		});

		// Generate button
		const btn = headerRow.createEl("button", { text: "Generate output", cls: "ft-output-generate-btn ft-session-action-btn" });
		const iconEl = btn.createSpan();
		setIcon(iconEl, "file-output");
		btn.prepend(iconEl);
		btn.addEventListener("click", () => this.onGenerate());

		this.listEl = section.createDiv({ cls: "ft-outputs-list" });
		this.renderList();
	}

	refreshList(): void {
		this.renderList();
		this.updateCount();
	}

	private updateCount(): void {
		const session = this.deps.getSession();
		if (this.countEl) {
			this.countEl.textContent = `(${session.outputArtifacts.length})`;
		}
	}

	private renderList(): void {
		const session = this.deps.getSession();
		if (!this.listEl) return;
		this.listEl.empty();

		if (session.outputArtifacts.length === 0) {
			const empty = this.listEl.createDiv({ cls: "ft-outputs-empty" });
			empty.setText("No output artifacts generated yet.");
			return;
		}

		for (const artifact of session.outputArtifacts) {
			this.renderArtifactRow(artifact);
		}
	}

	private renderArtifactRow(artifact: SessionOutputArtifact): void {
		const row = this.listEl!.createDiv({ cls: "ft-output-row" });

		const iconEl = row.createSpan();
		setIcon(iconEl, "file-text");

		const name = artifact.path.split("/").pop() ?? artifact.path;
		const link = row.createEl("a", { text: name, cls: "ft-output-link" });
		link.title = artifact.path;
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.deps.openFile(artifact.path);
		});

		const date = new Date(artifact.generatedAt).toISOString().split("T")[0];
		row.createEl("span", { text: date, cls: "ft-output-date" });
	}
}
