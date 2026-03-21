import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";
import type { ProjectConfig, HealthScore, TodoItem } from "../../domain/projects/types.js";

const styles = css`
	.section { margin-bottom: var(--flowti-space-md, 16px); }
	.section h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
	.btn {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}
	.btn:hover { background: var(--background-modifier-hover, #333); }
	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.text-input {
		flex: 1;
		min-width: 140px;
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-primary, #1e1e1e);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
	}
	.text-input:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.todo-list { list-style: none; padding: 0; margin: 0; }
	.todo-list li { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: var(--flowti-font-sm, 0.85em); }
	.muted { color: var(--text-muted, #999); font-size: var(--flowti-font-sm, 0.85em); }
	.hint { margin: 0 0 10px; line-height: 1.45; max-width: 52em; }
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
	.score { font-size: 1.5em; font-weight: 600; color: var(--interactive-accent, #7c3aed); }
`;

export class FlowtiTabOverview extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		notePath: { type: String },
		brief: { type: Object },
		config: { type: Object },
		healthScore: { type: Object },
		healthError: { type: String },
		todos: { type: Array },
		todosExist: { type: Boolean },
		hubLocked: { type: Boolean, attribute: "hub-locked" },
	};

	static styles = [tokens, styles];

	projectName = "";
	notePath = "";
	brief: Record<string, string | undefined> | undefined;
	config: ProjectConfig | undefined;
	healthScore: HealthScore | null = null;
	healthError = "";
	todos: TodoItem[] = [];
	todosExist = false;
	hasSitemap = false;
	hasCanvas = false;
	canvasChanged = false;

	protected renderContent() {
		const h = this.healthScore;
		return html`
			<div class="section">
				<h3>Project</h3>
				<div class="row">
					${this.notePath
						? html`<button type="button" class="btn" @click="${() => this.emit("open-project-note", { path: this.notePath })}">Open brief</button>`
						: html`<span class="muted">No ProjectBrief yet</span>`}
					<button type="button" class="btn" @click="${() => this.emit("open-project-folder", { name: this.projectName })}">Reveal folder</button>
				</div>
				${this.brief?.goal ? html`<p class="muted" style="margin-top:8px">${this.brief.goal}</p>` : ""}
			</div>
			<div class="section">
				<h3>Product map</h3>
				<p class="muted hint">
					Start here: sketch the product in <strong>sitemap.canvas</strong>, then sync into <strong>configs/sitemap.json</strong> (source of truth for Storybook and the component library).
					You can also fill that JSON from markdown via Config and the Components tab import.
				</p>
				<p class="muted hint">${this.productMapStatusLine()}</p>
				<div class="row">
					<button type="button" class="btn" @click="${() => this.emit("canvas-open", {})}">Open sitemap.canvas</button>
					<button type="button" class="btn" ?disabled="${this.hubLocked}" @click="${() => this.emit("canvas-generate", { preset: "default" })}">Generate baseline canvas</button>
					<button type="button" class="btn" ?disabled="${this.hubLocked}" @click="${() => this.emit("canvas-merge", {})}">Sync canvas → sitemap.json</button>
				</div>
			</div>
			<div class="section">
				<h3>Health</h3>
				<div class="row">
					<button type="button" class="btn" @click="${() => this.emit("health-refresh", {})}">Refresh</button>
					${h ? html`<span class="score">${h.overall}</span><span class="muted">${h.grade}</span>` : ""}
					${this.healthError ? html`<span class="muted">${this.healthError}</span>` : ""}
				</div>
			</div>
			<div class="section">
				<h3>TODOs</h3>
				<div class="row" style="margin-bottom:8px">
					<input id="todo-input" class="btn" style="flex:1;min-width:120px;padding:6px 8px" placeholder="Add task..." @keydown="${this.onTodoKey}" />
					<button type="button" class="btn" @click="${this.addTodo}">Add</button>
				</div>
				<ul class="todo-list">
					${this.todos.map((t, i) => html`
						<li>
							<input type="checkbox" .checked="${t.done}" @change="${() => this.emit("todo-toggle", { index: i })}" />
							<span style="${t.done ? "opacity:0.5;text-decoration:line-through" : ""}">${t.text}</span>
							<button type="button" class="btn" @click="${() => this.emit("todo-delete", { index: i })}">×</button>
						</li>
					`)}
				</ul>
				${!this.todosExist && this.todos.length === 0 ? html`<p class="muted">No TODO.md yet — add a task to create it.</p>` : ""}
			</div>
		`;
	}

	private productMapStatusLine(): string {
		if (!this.hasCanvas && !this.hasSitemap) return "No canvas or sitemap.json yet — open or generate a baseline canvas first.";
		if (!this.hasSitemap && this.hasCanvas) return "Canvas present; sync when you are ready to write configs/sitemap.json.";
		if (this.hasSitemap && this.canvasChanged) return "Canvas differs from last sync — use Sync to update sitemap.json.";
		if (this.hasSitemap) return "sitemap.json is present; use Components to run Storybook against it.";
		return "";
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	private onTodoKey = (e: KeyboardEvent): void => {
		if (e.key === "Enter") this.addTodo();
	};

	private addTodo(): void {
		const input = this.shadowRoot?.getElementById("todo-input") as HTMLInputElement | null;
		const text = input?.value.trim();
		if (!text) return;
		this.emit("todo-add", { text });
		if (input) input.value = "";
	}
}

if (!customElements.get("flowti-tab-overview")) customElements.define("flowti-tab-overview", FlowtiTabOverview);
