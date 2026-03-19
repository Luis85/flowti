/**
 * Storybook management section for the project hub sidepanel.
 * Three visual states: not installed, installed (idle), running.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookFramework } from "../../domain/projects/types.js";
import "../shared/ft-process-log.js";

const FRAMEWORKS: { id: StorybookFramework; label: string }[] = [
	{ id: "html", label: "HTML" },
	{ id: "react", label: "React" },
	{ id: "vue3", label: "Vue" },
	{ id: "angular", label: "Angular" },
	{ id: "web_components", label: "Web Components" },
	{ id: "svelte", label: "Svelte" },
];

export class FlowtiStorybookSection extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		installed: { type: Boolean },
		framework: { type: String },
		running: { type: Boolean },
		url: { type: String },
		pid: { type: Number },
		busy: { type: Boolean },
		busyLabel: { type: String },
		outputLines: { type: Array },
		errorNote: { type: String },
		hasStaticBuild: { type: Boolean },
		showConfirm: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
			}

			.section-header {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 600;
				color: var(--text-normal);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.not-configured {
				padding: var(--flowti-space-md, 16px);
				text-align: center;
				color: var(--text-muted);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.not-configured p {
				margin: 0 0 var(--flowti-space-sm, 8px) 0;
			}

			.setup-hint {
				font-weight: 500;
				color: var(--text-normal);
			}

			.framework-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: var(--flowti-space-sm, 8px);
			}

			.framework-btn {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--background-modifier-border);
				background: none;
				color: var(--text-normal);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				text-align: center;
			}

			.framework-btn:hover {
				background: var(--background-modifier-hover);
				border-color: var(--interactive-accent);
				color: var(--interactive-accent);
			}

			.status-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				margin-bottom: var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.dot--running {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: var(--color-green, #4caf50);
				flex-shrink: 0;
			}

			.framework-badge {
				display: inline-block;
				padding: 2px 8px;
				border-radius: var(--flowti-radius, 4px);
				background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
				color: var(--interactive-accent);
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
			}

			.status-label {
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted);
			}

			.status-label--running {
				color: var(--color-green, #4caf50);
				font-weight: 500;
			}

			.url-label {
				color: var(--text-muted);
				font-family: var(--font-monospace);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.actions {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm, 8px);
			}

			.action-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--background-modifier-border);
				background: none;
				color: var(--text-normal);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.action-btn:hover {
				background: var(--background-modifier-hover);
				border-color: var(--interactive-accent);
				color: var(--interactive-accent);
			}

			.action-btn--danger:hover {
				color: var(--color-red, #e53935);
				border-color: var(--color-red, #e53935);
			}

			.confirm-row {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs, 4px);
			}

			.confirm-text {
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted, #999);
			}

			.action-btn--primary {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border-color: var(--interactive-accent);
			}

			.action-btn--primary:hover {
				opacity: 0.9;
			}

			.action-btn:disabled {
				opacity: 0.4;
				cursor: not-allowed;
				pointer-events: none;
			}

			.output-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-top: var(--flowti-space-sm, 8px);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.output-header__label {
				font-size: 0.75em;
				color: var(--text-muted, #999);
			}

			.output-header__dismiss {
				background: none;
				border: none;
				color: var(--text-muted, #999);
				cursor: pointer;
				font-size: 1.1em;
				padding: 0 4px;
			}

			.output-header__dismiss:hover {
				color: var(--text-normal, #ddd);
			}

			.busy-section {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
			}

			.busy-label {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-muted);
			}

			.spinner {
				width: 14px; height: 14px;
				border: 2px solid var(--background-modifier-border);
				border-top-color: var(--interactive-accent);
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}

			@keyframes spin { to { transform: rotate(360deg); } }

			.error-note {
				display: flex;
				align-items: flex-start;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--color-red, #e53935) 10%, transparent);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm, 0.85em);
				line-height: 1.4;
			}

			.error-note__text {
				flex: 1;
				white-space: pre-wrap;
				word-break: break-word;
			}

			.error-note__dismiss {
				flex-shrink: 0;
				background: none;
				border: none;
				color: var(--text-muted);
				cursor: pointer;
				font-size: 1.1em;
				padding: 0 4px;
				line-height: 1;
			}

			.error-note__dismiss:hover {
				color: var(--text-normal);
			}

			.output-log {
				max-height: 200px;
				overflow-y: auto;
				background: var(--background-primary, #1e1e1e);
				border: 1px solid var(--background-modifier-border);
				border-radius: var(--flowti-radius-sm, 4px);
				padding: var(--flowti-space-sm, 8px);
				font-family: var(--font-monospace);
				font-size: 0.75em;
				line-height: 1.5;
				color: var(--text-muted);
				white-space: pre-wrap;
				word-break: break-all;
			}
		`,
	];

	installed = false;
	framework = "";
	running = false;
	url = "";
	pid = 0;
	busy = false;
	busyLabel = "";
	outputLines: string[] = [];
	errorNote = "";
	hasStaticBuild = false;
	showConfirm = false;

	protected renderContent() {
		const main = this.busy
			? ""
			: !this.installed
				? this.renderNotInstalled()
				: this.running
					? this.renderRunning()
					: this.renderInstalled();
		return html`
			${!this.busy ? this.renderImportActions() : ""}
			${main}
			<ft-process-log
				.lines="${this.outputLines}"
				.busy="${this.busy}"
				.busyLabel="${this.busyLabel || "Working..."}"
				.errorNote="${this.errorNote}"
				@dismiss="${() => { this.outputLines = []; this.errorNote = ""; }}"
			></ft-process-log>
		`;
	}

	private renderNotInstalled() {
		return html`
			<div class="not-configured">
				<p>Component workshop — build and preview UI in isolation with live docs and accessibility checks.</p>
				<p class="setup-hint">Select a framework to initialize:</p>
				<div class="framework-grid">
					${FRAMEWORKS.map((fw) => html`
						<button class="framework-btn" @click="${() => this.dispatchInstall(fw.id)}" title="Initialize Storybook with ${fw.label} + Vite builder">${fw.label}</button>
					`)}
				</div>
			</div>
		`;
	}

	private renderImportActions() {
		return "";
	}

	private renderInstalled() {
		return html`
			<div class="actions">
				<button class="action-btn action-btn--primary" ?disabled="${this.busy}" @click="${() => this.dispatchStart()}" title="Launch dev server on localhost:6006">Start</button>
				${this.hasStaticBuild ? html`
					<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchPreview()}" title="Open static build in viewer">Preview</button>
				` : ""}
				<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
				<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchOpenFolder()}" title="Open components folder in vault">Open folder</button>
				${this.showConfirm ? html`
					<span class="confirm-row">
						<span class="confirm-text">Delete and recreate?</span>
						<button class="action-btn action-btn--danger" @click="${() => { this.showConfirm = false; this.dispatchRegenerateConfirmed(); }}">Confirm</button>
						<button class="action-btn" @click="${() => { this.showConfirm = false; }}">Cancel</button>
					</span>
				` : html`
					<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => { this.showConfirm = true; }}" title="Delete and recreate component library from sitemap">Regenerate</button>
				`}
			</div>
		`;
	}

	private renderRunning() {
		return html`
			<div class="status-row">
				<span class="url-label">${this.url}</span>
			</div>
			<div class="actions">
				<button class="action-btn action-btn--primary" ?disabled="${this.busy}" @click="${() => this.dispatchView()}" title="Open Storybook in browser">View</button>
				${this.hasStaticBuild ? html`
					<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchPreview()}" title="Open static build in viewer">Preview</button>
				` : ""}
				<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => this.dispatchStop()}" title="Stop the dev server process">Stop</button>
				<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
			</div>
		`;
	}


	private dispatchInstall(framework: StorybookFramework): void {
		this.dispatchEvent(new CustomEvent("storybook-install", {
			detail: { framework },
			bubbles: true,
			composed: true,
		}));
	}

	private dispatchStart(): void {
		this.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
	}

	private dispatchStop(): void {
		this.dispatchEvent(new CustomEvent("storybook-stop", { bubbles: true, composed: true }));
	}

	private dispatchBuild(): void {
		this.dispatchEvent(new CustomEvent("storybook-build", { bubbles: true, composed: true }));
	}

	private dispatchImportMarkdown(): void {
		this.dispatchEvent(new CustomEvent("storybook-import", { bubbles: true, composed: true }));
	}

	private dispatchScaffold(): void {
		this.dispatchEvent(new CustomEvent("storybook-scaffold", { bubbles: true, composed: true }));
	}

	private dispatchRegenerateConfirmed(): void {
		this.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed", { bubbles: true, composed: true }));
	}

	private dispatchOpenFolder(): void {
		this.dispatchEvent(new CustomEvent("storybook-open-folder", { bubbles: true, composed: true }));
	}

	private dispatchView(): void {
		this.dispatchEvent(new CustomEvent("storybook-view", { bubbles: true, composed: true }));
	}

	private dispatchPreview(): void {
		this.dispatchEvent(new CustomEvent("storybook-preview", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-storybook-section")) customElements.define("flowti-storybook-section", FlowtiStorybookSection);
