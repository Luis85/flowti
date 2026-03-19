/**
 * Config tab for the project detail view.
 * Exposes markdown sitemap importer settings:
 * source folder, strategy, and required fields.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ImportStrategy } from "../../domain/projects/types.js";

const STRATEGIES: { id: ImportStrategy; label: string }[] = [
	{ id: "category", label: "Category" },
	{ id: "flat", label: "Flat" },
	{ id: "hierarchical", label: "Hierarchical" },
];

const LOCKED_FIELDS = ["name", "category"] as const;
const OPTIONAL_FIELDS = ["description", "status", "props", "slots", "variants"] as const;

export class FlowtiConfigTab extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sourcePath: { type: String },
		strategy: { type: String },
		requiredFields: { type: Array },
		saveStatus: { type: String },
		hasCanvas: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
			}

			.section-title {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.field-group {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.field-label {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
			}

			.folder-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.folder-display {
				flex: 1;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--background-primary, #1e1e1e);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				font-family: var(--font-monospace);
				min-height: 1.6em;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.folder-display--empty {
				color: var(--text-faint, #666);
				font-style: italic;
				font-family: inherit;
			}

			.browse-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				flex-shrink: 0;
			}

			.browse-btn:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}

			.strategy-group {
				display: flex;
				gap: var(--flowti-space-xs, 4px);
			}

			.strategy-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.strategy-btn:hover {
				background: var(--background-modifier-hover, #333);
			}

			.strategy-btn--active {
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
			}

			.chip {
				padding: 2px 10px;
				border-radius: 12px;
				font-size: var(--flowti-font-sm, 0.85em);
				border: 1px solid var(--background-modifier-border, #444);
				cursor: pointer;
				user-select: none;
			}

			.chip--locked {
				background: var(--background-modifier-hover, #333);
				color: var(--text-faint, #666);
				cursor: default;
				opacity: 0.6;
			}

			.chip--active {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 20%, transparent);
				color: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.chip--inactive {
				background: none;
				color: var(--text-muted, #999);
			}

			.chip--inactive:hover {
				background: var(--background-modifier-hover, #333);
			}

			.save-row {
				display: flex;
				justify-content: flex-end;
				padding-top: var(--flowti-space-sm, 8px);
				border-top: 1px solid var(--background-modifier-border, #333);
			}

			.save-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-lg, 24px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				cursor: pointer;
			}

			.save-btn:hover {
				opacity: 0.9;
			}

			.save-feedback {
				font-size: var(--flowti-font-sm, 0.85em);
				padding: var(--flowti-space-xs, 4px) 0;
			}

			.save-feedback--success {
				color: var(--color-green, #4caf50);
			}

			.save-feedback--error {
				color: var(--color-red, #e53935);
			}

			.import-section {
				margin-top: var(--flowti-space-md, 16px);
				padding-top: var(--flowti-space-md, 16px);
				border-top: 1px solid var(--background-modifier-border, #333);
			}
		`,
	];

	sourcePath = "";
	strategy: ImportStrategy = "category";
	requiredFields: string[] = [];
	saveStatus = "";
	hasCanvas = false;

	protected renderContent() {
		return html`
			${!this.hasCanvas ? html`
				<div class="field-group">
					<div class="section-title">Sitemap Canvas</div>
					<span class="field-label">Pick a preset to generate a starter canvas</span>
					<div class="strategy-group">
						${[
							{ id: "web-app", label: "Web App" },
							{ id: "landing", label: "Landing" },
							{ id: "dashboard", label: "Dashboard" },
							{ id: "e-commerce", label: "E-Commerce" },
							{ id: "docs", label: "Docs" },
							{ id: "system-design", label: "System" },
							{ id: "service-design", label: "Service" },
							{ id: "product-design", label: "Product" },
						].map((p) => html`
							<button class="strategy-btn" @click="${() => this.dispatchGeneratePreset(p.id)}" title="Generate ${p.label} sitemap canvas">${p.label}</button>
						`)}
					</div>
				</div>
			` : ""}
			<div class="section-title">Markdown Sitemap Import</div>
			${this.renderSourceFolder()}
			${this.renderStrategy()}
			${this.renderRequiredFields()}
			${this.renderSaveButton()}
			${this.saveStatus ? html`
				<div class="save-feedback ${this.saveStatus === "Saved" ? "save-feedback--success" : "save-feedback--error"}">${this.saveStatus}</div>
			` : ""}
		`;
	}

	private renderSourceFolder() {
		const isEmpty = !this.sourcePath;
		return html`
			<div class="field-group">
				<span class="field-label">Source folder</span>
				<div class="folder-row">
					<span class="folder-display ${isEmpty ? "folder-display--empty" : ""}">${this.sourcePath || "No folder selected"}</span>
					<button class="browse-btn" @click="${this.dispatchBrowse}">Browse</button>
					<button class="browse-btn" @click="${this.dispatchImport}" title="Import markdown files into sitemap">Import</button>
				</div>
			</div>
		`;
	}

	private renderStrategy() {
		return html`
			<div class="field-group">
				<span class="field-label">Strategy</span>
				<div class="strategy-group">
					${STRATEGIES.map((s) => html`
						<button
							class="strategy-btn ${this.strategy === s.id ? "strategy-btn--active" : ""}"
							@click="${() => { this.strategy = s.id; }}"
						>${s.label}</button>
					`)}
				</div>
			</div>
		`;
	}

	private renderRequiredFields() {
		return html`
			<div class="field-group">
				<span class="field-label">Required fields</span>
				<div class="chips">
					${LOCKED_FIELDS.map((f) => html`
						<span class="chip chip--locked" title="Always required">${f}</span>
					`)}
					${OPTIONAL_FIELDS.map((f) => html`
						<span
							class="chip ${this.requiredFields.includes(f) ? "chip--active" : "chip--inactive"}"
							@click="${() => this.toggleField(f)}"
						>${f}</span>
					`)}
				</div>
			</div>
		`;
	}

	private renderSaveButton() {
		return html`
			<div class="save-row">
				<button class="save-btn" @click="${this.dispatchSave}">Save</button>
			</div>
		`;
	}

	private toggleField(field: string): void {
		if (this.requiredFields.includes(field)) {
			this.requiredFields = this.requiredFields.filter((f) => f !== field);
		} else {
			this.requiredFields = [...this.requiredFields, field];
		}
	}

	private dispatchBrowse(): void {
		this.dispatchEvent(new CustomEvent("config-browse-folder", { bubbles: true, composed: true }));
	}

	private dispatchSave(): void {
		const allRequired = [...LOCKED_FIELDS, ...this.requiredFields];
		this.dispatchEvent(new CustomEvent("config-save", {
			detail: {
				path: this.sourcePath,
				strategy: this.strategy,
				requiredFields: allRequired,
			},
			bubbles: true,
			composed: true,
		}));
	}

	private dispatchImport(): void {
		this.dispatchEvent(new CustomEvent("storybook-import", { bubbles: true, composed: true }));
	}

	private dispatchGeneratePreset(preset: string): void {
		this.dispatchEvent(new CustomEvent("canvas-generate", { detail: { preset }, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-config-tab")) customElements.define("flowti-config-tab", FlowtiConfigTab);
