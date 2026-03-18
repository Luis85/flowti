/**
 * Storybook management section for the project hub sidepanel.
 * Three visual states: not installed, installed (idle), running.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookFramework } from "../../domain/projects/types.js";

const FRAMEWORKS: readonly StorybookFramework[] = ["html-vite", "react", "vue", "angular"] as const;

export class FlowtiStorybookSection extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		installed: { type: Boolean },
		framework: { type: String },
		running: { type: Boolean },
		url: { type: String },
		pid: { type: Number },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: block;
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
				margin: 0 0 var(--flowti-space-md, 16px) 0;
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

			.action-btn--primary {
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				border-color: var(--interactive-accent);
			}

			.action-btn--primary:hover {
				opacity: 0.9;
			}
		`,
	];

	installed = false;
	framework = "";
	running = false;
	url = "";
	pid = 0;

	protected renderContent() {
		if (!this.installed) {
			return this.renderNotInstalled();
		}
		if (this.running) {
			return this.renderRunning();
		}
		return this.renderInstalled();
	}

	private renderNotInstalled() {
		return html`
			<div class="not-configured">
				<p>Storybook not configured</p>
				<div class="framework-grid">
					${FRAMEWORKS.map((fw) => html`
						<button class="framework-btn" @click="${() => this.dispatchInstall(fw)}">${fw}</button>
					`)}
				</div>
			</div>
		`;
	}

	private renderInstalled() {
		return html`
			<div class="status-row">
				<span class="framework-badge">${this.framework}</span>
			</div>
			<div class="actions">
				<button class="action-btn action-btn--primary" @click="${this.dispatchStart}">Start</button>
				<button class="action-btn" @click="${this.dispatchScaffold}">Scaffold from sitemap</button>
				<button class="action-btn" @click="${this.dispatchBuild}">Build</button>
				<button class="action-btn" @click="${this.dispatchOpenFolder}">Open folder</button>
			</div>
		`;
	}

	private renderRunning() {
		return html`
			<div class="status-row">
				<span class="dot--running"></span>
				<span class="framework-badge">${this.framework}</span>
				<span class="url-label">${this.url}</span>
			</div>
			<div class="actions">
				<button class="action-btn action-btn--primary" @click="${this.dispatchView}">View</button>
				<button class="action-btn action-btn--danger" @click="${this.dispatchStop}">Stop</button>
				<button class="action-btn" @click="${this.dispatchBuild}">Build</button>
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

	private dispatchScaffold(): void {
		this.dispatchEvent(new CustomEvent("storybook-scaffold", { bubbles: true, composed: true }));
	}

	private dispatchOpenFolder(): void {
		this.dispatchEvent(new CustomEvent("storybook-open-folder", { bubbles: true, composed: true }));
	}

	private dispatchView(): void {
		this.dispatchEvent(new CustomEvent("storybook-view", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-storybook-section")) customElements.define("flowti-storybook-section", FlowtiStorybookSection);
