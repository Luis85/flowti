/**
 * Overview tab for the project detail view.
 * Shows brief, health summary, canvas generators, and TODO list.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ProjectBrief, ProjectConfig, HealthScore, TodoItem } from "../../domain/projects/types.js";

const PRESETS = [
	{ id: "web-app", label: "Web App" },
	{ id: "landing", label: "Landing" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "e-commerce", label: "E-Commerce" },
	{ id: "enterprise", label: "Enterprise" },
	{ id: "cli", label: "CLI" },
	{ id: "obsidian-plugin", label: "Plugin" },
	{ id: "docs", label: "Docs" },
	{ id: "system-design", label: "System" },
	{ id: "service-design", label: "Service" },
	{ id: "product-design", label: "Product" },
];

export class FlowtiTabOverview extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		brief: { type: Object },
		healthScore: { type: Object },
		healthError: { type: String },
		todos: { type: Array },
		todosExist: { type: Boolean },
		config: { type: Object },
		hasCanvas: { type: Boolean },
		hasSitemap: { type: Boolean },
		canvasPreset: { type: String },
		canvasChanged: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host { display: flex; flex-direction: column; gap: var(--flowti-space-md, 16px); }
			.section { display: flex; flex-direction: column; gap: var(--flowti-space-sm, 8px); }
			.section-title { font-size: var(--flowti-font-sm, 0.85em); font-weight: 500; color: var(--text-muted, #999); margin-bottom: var(--flowti-space-xs, 4px); }
			.section + .section { padding-top: var(--flowti-space-md, 16px); border-top: 1px solid var(--background-modifier-border, #333); }

			.brief-goal { font-size: 1em; color: var(--text-normal, #ddd); line-height: 1.4; }
			.brief-meta { display: flex; gap: var(--flowti-space-sm, 8px); flex-wrap: wrap; font-size: var(--flowti-font-sm, 0.85em); color: var(--text-muted, #999); }
			.brief-status { padding: 2px 10px; border-radius: 12px; font-size: var(--flowti-font-sm, 0.85em); background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 20%, transparent); color: var(--interactive-accent, #7c3aed); }
			.brief-actions { display: flex; gap: var(--flowti-space-xs, 4px); }

			.brief-btn, .health-refresh-btn, .preset-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none; color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em); cursor: pointer;
			}
			.brief-btn:hover, .health-refresh-btn:hover, .preset-btn:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}

			.config-badges { display: flex; flex-wrap: wrap; gap: var(--flowti-space-xs, 4px); }
			.config-badge { padding: 2px 8px; border-radius: 12px; font-size: var(--flowti-font-sm, 0.85em); background: var(--background-modifier-hover, #333); color: var(--text-muted, #999); }

			.health-row { display: flex; align-items: center; gap: var(--flowti-space-md, 16px); }
			.health-score-circle { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25em; font-weight: 700; color: #fff; flex-shrink: 0; }
			.health-score-circle--green { background: var(--color-green, #4caf50); }
			.health-score-circle--amber { background: var(--color-yellow, #ff9800); }
			.health-score-circle--red { background: var(--color-red, #e53935); }
			.health-info { flex: 1; display: flex; flex-direction: column; gap: var(--flowti-space-xs, 4px); }
			.health-grade { padding: 2px 10px; border-radius: 12px; font-size: var(--flowti-font-sm, 0.85em); font-weight: 600; background: var(--background-modifier-hover, #333); color: var(--text-normal, #ddd); display: inline-block; width: fit-content; }
			.health-categories { display: flex; flex-direction: column; gap: 3px; }
			.health-cat-row { display: flex; align-items: center; gap: var(--flowti-space-sm, 8px); font-size: var(--flowti-font-sm, 0.85em); }
			.health-cat-label { width: 70px; color: var(--text-muted, #999); text-transform: capitalize; }
			.health-cat-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--background-modifier-hover, #333); overflow: hidden; }
			.health-cat-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
			.health-cat-fill--green { background: var(--color-green, #4caf50); }
			.health-cat-fill--amber { background: var(--color-yellow, #ff9800); }
			.health-cat-fill--red { background: var(--color-red, #e53935); }
			.health-cat-val { width: 32px; text-align: right; color: var(--text-muted, #999); }
			.health-refresh-btn { align-self: flex-start; }
			.health-empty, .health-error, .todo-empty { font-size: var(--flowti-font-sm, 0.85em); }
			.health-empty, .todo-empty { color: var(--text-muted, #999); }
			.health-error { color: var(--color-red, #e53935); }

			.preset-row { display: flex; flex-wrap: wrap; gap: var(--flowti-space-xs, 4px); }
			.preset-btn--active { background: var(--interactive-accent, #7c3aed); color: var(--text-on-accent, #fff); border-color: var(--interactive-accent, #7c3aed); }
			.canvas-actions { display: flex; align-items: center; gap: var(--flowti-space-sm, 8px); margin-top: var(--flowti-space-sm, 8px); }
			.canvas-merge-btn { padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px); border-radius: var(--flowti-radius-sm, 4px); border: 1px solid var(--interactive-accent, #7c3aed); background: var(--interactive-accent, #7c3aed); color: var(--text-on-accent, #fff); font-size: var(--flowti-font-sm, 0.85em); font-weight: 500; cursor: pointer; }
			.canvas-merge-btn:hover { opacity: 0.9; }
			.canvas-open-btn { padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px); border-radius: var(--flowti-radius-sm, 4px); border: 1px solid var(--background-modifier-border, #444); background: none; color: var(--text-normal, #ddd); font-size: var(--flowti-font-sm, 0.85em); cursor: pointer; }
			.canvas-open-btn:hover { background: var(--background-modifier-hover, #333); }
			.canvas-changed-badge { padding: 2px 8px; border-radius: 12px; font-size: var(--flowti-font-xs, 0.75em); background: #422006; color: #f59e0b; font-weight: 600; }

			.todo-add-row { display: flex; gap: var(--flowti-space-xs, 4px); }
			.todo-input { flex: 1; padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px); border: 1px solid var(--background-modifier-border, #444); border-radius: var(--flowti-radius-sm, 4px); background: var(--background-primary, #1e1e1e); color: var(--text-normal, #ddd); font-size: var(--flowti-font-sm, 0.85em); }
			.todo-add-btn { padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px); border-radius: var(--flowti-radius-sm, 4px); border: 1px solid var(--interactive-accent, #7c3aed); background: var(--interactive-accent, #7c3aed); color: var(--text-on-accent, #fff); font-size: var(--flowti-font-sm, 0.85em); font-weight: 500; cursor: pointer; }
			.todo-add-btn:hover { opacity: 0.9; }
			.todo-list { display: flex; flex-direction: column; gap: 2px; }
			.todo-item { display: flex; align-items: center; gap: var(--flowti-space-sm, 8px); padding: var(--flowti-space-xs, 4px) 0; }
			.todo-checkbox { cursor: pointer; }
			.todo-text { flex: 1; font-size: var(--flowti-font-sm, 0.85em); color: var(--text-normal, #ddd); }
			.todo-text--done { text-decoration: line-through; color: var(--text-muted, #999); }
			.todo-delete-btn { padding: 2px 8px; border-radius: var(--flowti-radius-sm, 4px); border: 1px solid transparent; background: none; color: var(--text-muted, #999); font-size: var(--flowti-font-sm, 0.85em); cursor: pointer; }
			.todo-delete-btn:hover { border-color: var(--color-red, #e53935); color: var(--color-red, #e53935); }
		`,
	];

	projectName = "";
	brief: ProjectBrief | undefined = undefined;
	healthScore: HealthScore | null = null;
	healthError = "";
	todos: TodoItem[] = [];
	todosExist = false;
	config: ProjectConfig | undefined = undefined;
	hasCanvas = false;
	hasSitemap = false;
	canvasPreset = "";
	canvasChanged = false;

	protected renderContent() {
		return html`
			${this.renderBriefSection()}
			${this.renderHealthSection()}
			${this.renderCanvasSection()}
			${this.renderTodoSection()}
		`;
	}

	private renderBriefSection() {
		if (!this.brief) {
			return html`
				<div class="section">
					<div class="section-title">Brief</div>
					<div class="brief-actions">
						<button class="brief-btn brief-create-btn"
							@click="${() => this.fire("create-note", { name: this.projectName })}"
						>Create brief</button>
					</div>
				</div>
			`;
		}
		return html`
			<div class="section">
				<div class="section-title">Brief</div>
				${this.brief.goal ? html`<div class="brief-goal">${this.brief.goal}</div>` : nothing}
				<div class="brief-meta">
					${this.brief.status ? html`<span class="brief-status">${this.brief.status}</span>` : nothing}
					${this.brief.start ? html`<span>${this.brief.start}</span>` : nothing}
					${this.brief.start && this.brief.end ? html`<span>-</span>` : nothing}
					${this.brief.end ? html`<span>${this.brief.end}</span>` : nothing}
				</div>
				${this.config ? this.renderConfigBadges() : nothing}
				<div class="brief-actions">
					<button class="brief-btn brief-open-btn"
						@click="${() => this.fire("open-project-note", { path: this.projectName })}"
					>Open note</button>
				</div>
			</div>
		`;
	}

	private renderConfigBadges() {
		const badges: string[] = [];
		if (this.config?.framework) badges.push(this.config.framework);
		if (this.config?.buildModes?.length) badges.push(...this.config.buildModes);
		if (this.config?.testPresets?.length) badges.push(...this.config.testPresets);
		if (!badges.length) return nothing;
		return html`
			<div class="config-badges">
				${badges.map((b) => html`<span class="config-badge">${b}</span>`)}
			</div>
		`;
	}

	private renderHealthSection() {
		return html`
			<div class="section">
				<div class="section-title">Health</div>
				${this.healthError ? html`<div class="health-error">${this.healthError}</div>` : nothing}
				${!this.healthError && this.healthScore ? this.renderHealthScore() : nothing}
				${!this.healthError && !this.healthScore ? html`<div class="health-empty">Run health check</div>` : nothing}
				<button class="health-refresh-btn"
					@click="${() => this.fire("health-refresh")}"
				>Refresh</button>
			</div>
		`;
	}

	private renderHealthScore() {
		const score = this.healthScore!;
		const colorClass = score.overall >= 80 ? "green" : score.overall >= 60 ? "amber" : "red";
		const cats = Object.entries(score.categories) as [string, number][];
		return html`
			<div class="health-row">
				<div class="health-score-circle health-score-circle--${colorClass}">${score.overall}</div>
				<div class="health-info">
					<span class="health-grade">Grade ${score.grade}</span>
					<div class="health-categories">
						${cats.map(([name, val]) => {
							const c = val >= 80 ? "green" : val >= 60 ? "amber" : "red";
							return html`
								<div class="health-cat-row">
									<span class="health-cat-label">${name}</span>
									<div class="health-cat-bar"><div class="health-cat-fill health-cat-fill--${c}" style="width:${val}%"></div></div>
									<span class="health-cat-val">${val}</span>
								</div>
							`;
						})}
					</div>
				</div>
			</div>
		`;
	}

	private renderCanvasSection() {
		return html`
			<div class="section">
				<div class="section-title">Sitemap Canvas</div>
				<div class="preset-row">
					${PRESETS.map((p) => html`
						<button class="preset-btn ${this.canvasPreset === p.id ? "preset-btn--active" : ""}"
							@click="${() => { this.canvasPreset = p.id; this.fire("canvas-generate", { preset: p.id }); }}"
						>${p.label}</button>
					`)}
				</div>
				${this.hasCanvas ? html`
					<div class="canvas-actions">
						<button class="canvas-merge-btn"
							@click="${() => this.fire("canvas-merge")}"
						>${this.hasSitemap ? "Merge to sitemap.json" : "Save as sitemap.json"}</button>
						<button class="canvas-open-btn"
							@click="${() => this.fire("canvas-generate")}"
						>Open canvas</button>
						${this.canvasChanged ? html`<span class="canvas-changed-badge">changed</span>` : nothing}
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderTodoSection() {
		if (!this.todosExist) {
			return html`
				<div class="section">
					<div class="section-title">TODOs</div>
					<div class="todo-empty">
						<button class="brief-btn"
							@click="${() => this.fire("todo-add", { text: "First task" })}"
						>Create TODO list</button>
					</div>
				</div>
			`;
		}
		return html`
			<div class="section">
				<div class="section-title">TODOs</div>
				<div class="todo-add-row">
					<input class="todo-input" type="text" placeholder="Add a task..." />
					<button class="todo-add-btn" @click="${this.handleTodoAdd}">Add</button>
				</div>
				<div class="todo-list">
					${this.todos.map((item, i) => html`
						<div class="todo-item">
							<input class="todo-checkbox" type="checkbox" .checked="${item.done}"
								@click="${() => this.fire("todo-toggle", { index: i })}" />
							<span class="todo-text ${item.done ? "todo-text--done" : ""}">${item.text}</span>
							<button class="todo-delete-btn"
								@click="${() => this.fire("todo-delete", { index: i })}"
							>x</button>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	private handleTodoAdd(): void {
		const input = this.shadowRoot?.querySelector(".todo-input") as HTMLInputElement | null;
		if (!input) return;
		const text = input.value.trim();
		if (!text) return;
		this.fire("todo-add", { text });
		input.value = "";
	}

	private fire(name: string, detail?: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-overview")) customElements.define("flowti-tab-overview", FlowtiTabOverview);
