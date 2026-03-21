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
				<h3>Sitemap canvas</h3>
				<div class="row">
					<button type="button" class="btn" @click="${() => this.emit("canvas-open", {})}">Open canvas</button>
					<button type="button" class="btn" @click="${() => this.emit("canvas-generate", { preset: "default" })}">Generate</button>
					<button type="button" class="btn" @click="${() => this.emit("canvas-merge", {})}">Merge changes</button>
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
