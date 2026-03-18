/**
 * Root Lit component for the Project Detail view.
 * Composes child components: header → note section → storybook section.
 * Dispatches navigation and action events to the controller.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { StorybookStatus, ProjectSummary } from "../../domain/projects/types.js";

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
		projects: { type: Array },
		searchQuery: { type: String },
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

			/* ── Project list styles ── */
			.list-header {
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal, #ddd);
			}

			.search-input {
				width: 100%;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--background-primary, #1e1e1e);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.project-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.project-item {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				cursor: pointer;
				border: none;
				background: none;
				color: var(--text-normal, #ddd);
				text-align: left;
				width: 100%;
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.project-item:hover {
				background: var(--background-modifier-hover, #333);
			}

			.project-item__name {
				flex: 1;
				font-weight: 500;
			}

			.project-item__badges {
				display: flex;
				gap: var(--flowti-space-xs, 4px);
				align-items: center;
			}

			.badge {
				font-size: 0.7em;
				padding: 1px 6px;
				border-radius: var(--flowti-radius-sm, 4px);
				font-weight: 500;
			}

			.badge--type {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
				color: var(--interactive-accent, #7c3aed);
			}

			.badge--sb {
				background: color-mix(in srgb, var(--color-green, #4caf50) 15%, transparent);
				color: var(--color-green, #4caf50);
			}

			.badge--running {
				background: color-mix(in srgb, var(--color-green, #4caf50) 20%, transparent);
				color: var(--color-green, #4caf50);
			}

			.badge--no-note {
				background: color-mix(in srgb, var(--color-yellow, #e5a00d) 15%, transparent);
				color: var(--color-yellow, #e5a00d);
			}

			.empty-list {
				padding: var(--flowti-space-xl, 32px);
				text-align: center;
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}
		`,
	];

	projectName = "";
	projectType = "";
	hasNote = false;
	notePath = "";
	storybook: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null };
	projects: ProjectSummary[] = [];
	searchQuery = "";

	protected renderContent() {
		if (!this.projectName) {
			return this.renderProjectList();
		}
		return html`
			${this.renderHeader()}
			${this.renderNoteSection()}
			${this.renderStorybookSection()}
		`;
	}

	private renderProjectList() {
		const filtered = this.searchQuery
			? this.projects.filter((p) => p.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
			: this.projects;

		return html`
			<div class="list-header">Projects</div>
			<input
				class="search-input"
				type="text"
				placeholder="Search projects..."
				.value="${this.searchQuery}"
				@input="${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}"
			/>
			${filtered.length === 0
				? html`<div class="empty-list">${this.projects.length === 0 ? "No projects found. Is the CLI server running?" : "No matches"}</div>`
				: html`<div class="project-list">${filtered.map((p) => this.renderProjectItem(p))}</div>`
			}
		`;
	}

	private renderProjectItem(p: ProjectSummary) {
		return html`
			<button class="project-item" @click="${() => this.selectProject(p.name)}">
				<span class="project-item__name">${p.name}</span>
				<span class="project-item__badges">
					${p.type !== "unknown" ? html`<span class="badge badge--type">${p.type}</span>` : ""}
					${!p.hasNote ? html`<span class="badge badge--no-note">no note</span>` : ""}
					${p.storybook.running ? html`<span class="badge badge--running">SB running</span>` : ""}
					${p.storybook.installed && !p.storybook.running ? html`<span class="badge badge--sb">${p.storybook.framework ?? "SB"}</span>` : ""}
				</span>
			</button>
		`;
	}

	private selectProject(name: string) {
		this.dispatchEvent(new CustomEvent("project-selected", { detail: { name }, bubbles: true, composed: true }));
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
