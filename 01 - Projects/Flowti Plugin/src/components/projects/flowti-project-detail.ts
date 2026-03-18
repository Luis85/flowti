/**
 * Root Lit component for the Project Detail view.
 * Composes child components: header → note section → storybook section.
 * Dispatches navigation and action events to the controller.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookStatus } from "../../domain/projects/types.js";

// Side-effect import to register child custom element
import "./flowti-storybook-section.js";

export class FlowtiProjectDetail extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String, attribute: "project-name" },
		projectType: { type: String, attribute: "project-type" },
		hasNote: { type: Boolean, attribute: "has-note" },
		notePath: { type: String, attribute: "note-path" },
		storybook: { type: Object },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
				padding: var(--flowti-space-md, 16px);
			}

			.header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.back-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: none;
				color: var(--text-muted, #999);
				cursor: pointer;
				font-size: 1em;
				flex-shrink: 0;
			}

			.back-btn:hover {
				background: var(--background-modifier-hover, #333);
				color: var(--text-normal, #ddd);
			}

			.project-name {
				font-size: 1.25em;
				font-weight: 600;
				color: var(--text-normal, #ddd);
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.type-badge {
				font-size: var(--flowti-font-xs, 0.75em);
				padding: 2px 8px;
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
				color: var(--interactive-accent, #7c3aed);
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				flex-shrink: 0;
			}

			.section {
				padding: var(--flowti-space-sm, 8px) 0;
				border-top: 1px solid var(--background-modifier-border, #333);
			}

			.section-title {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.note-link {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs, 4px);
				color: var(--interactive-accent, #7c3aed);
				cursor: pointer;
				font-size: var(--flowti-font-sm, 0.85em);
				border: none;
				background: none;
				padding: 4px 0;
			}

			.note-link:hover {
				text-decoration: underline;
			}

			.note-warning {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 10%, transparent);
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.note-create {
				padding: 4px 12px;
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: none;
				color: var(--interactive-accent, #7c3aed);
				cursor: pointer;
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
			}

			.note-create:hover {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
			}
		`,
	];

	projectName = "";
	projectType = "";
	hasNote = false;
	notePath = "";
	storybook: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null };

	protected renderContent() {
		return html`
			${this.renderHeader()}
			${this.renderNoteSection()}
			${this.renderStorybookSection()}
		`;
	}

	private renderHeader() {
		return html`
			<div class="header">
				<button class="back-btn" @click="${this.dispatchBackToList}" title="Back to project list">&larr;</button>
				<span class="project-name">${this.projectName}</span>
				<span class="type-badge">${this.projectType}</span>
			</div>
		`;
	}

	private renderNoteSection() {
		return html`
			<div class="section">
				<div class="section-title">Note</div>
				${this.hasNote ? this.renderNoteLink() : this.renderNoteWarning()}
			</div>
		`;
	}

	private renderNoteLink() {
		return html`
			<button class="note-link" @click="${this.dispatchOpenNote}">Project note</button>
		`;
	}

	private renderNoteWarning() {
		return html`
			<div class="note-warning">
				<span>No project note found</span>
				<button class="note-create" @click="${this.dispatchCreateNote}">Create note</button>
			</div>
		`;
	}

	private renderStorybookSection() {
		return html`
			<div class="section">
				<flowti-storybook-section
					.installed="${this.storybook.installed}"
					.framework="${this.storybook.framework}"
					.running="${this.storybook.running}"
					.url="${this.storybook.url}"
					.pid="${this.storybook.pid}"
				></flowti-storybook-section>
			</div>
		`;
	}

	private dispatchBackToList(): void {
		this.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
	}

	private dispatchOpenNote(): void {
		this.dispatchEvent(new CustomEvent("open-project-note", {
			detail: { path: this.notePath },
			bubbles: true,
			composed: true,
		}));
	}

	private dispatchCreateNote(): void {
		this.dispatchEvent(new CustomEvent("create-project-note", {
			detail: { name: this.projectName },
			bubbles: true,
			composed: true,
		}));
	}
}

if (!customElements.get("flowti-project-detail")) customElements.define("flowti-project-detail", FlowtiProjectDetail);
