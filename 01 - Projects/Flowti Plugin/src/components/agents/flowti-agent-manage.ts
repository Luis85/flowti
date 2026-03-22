/**
 * Agent definition editor — create / edit / delete vault agents (markdown + companion JSON).
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { AgentCard } from "../../domain/agents/types.js";
import type { AgentBlueprint } from "../../domain/projects/types.js";

export class FlowtiAgentManage extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		open: { type: Boolean },
		agents: { type: Array },
		editingName: { type: String },
		formName: { type: String },
		formPersona: { type: String },
		formMood: { type: String },
		formDomain: { type: String },
		formInt: { type: Number },
		formCha: { type: Number },
		formProvider: { type: String },
		formSystemPrompt: { type: String },
		formAllowedTools: { type: String },
		formGlobs: { type: String },
		formSuggestedTasks: { type: String },
		formDescription: { type: String },
		statusMessage: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host { display: block; }
			.overlay {
				position: absolute;
				inset: 0;
				background: var(--background-primary);
				z-index: 20;
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}
			.overlay:not(.open) { display: none; }
			.head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.body { flex: 1; overflow: auto; padding: var(--flowti-space-md); }
			label { display: block; font-size: 0.75em; color: var(--flowti-color-muted); margin-top: 8px; }
			input, textarea, select {
				width: 100%;
				box-sizing: border-box;
				margin-top: 4px;
				font-size: var(--flowti-font-sm, 0.85em);
			}
			textarea { min-height: 72px; font-family: inherit; }
			.prompt-area { min-height: 120px; }
			.row { display: flex; gap: 8px; }
			.row > * { flex: 1; }
			.actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
			button {
				padding: 6px 12px;
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: 0.85em;
			}
			.danger { color: var(--color-red, #e53935); }
			.list { margin-bottom: 12px; font-size: 0.8em; color: var(--flowti-color-muted); }
			.status { margin-top: 8px; font-size: 0.8em; color: var(--flowti-color-success); }
			.status.err { color: var(--color-red, #e53935); }
			.agent-row { margin-bottom: 4px; }
			button.linkish { background: none; border: none; padding: 0; color: var(--text-accent); text-decoration: underline; }
		`,
	];

	open = false;
	agents: AgentCard[] = [];
	editingName = "";
	formName = "";
	formPersona = "";
	formMood = "";
	formDomain = "";
	formInt: number | undefined = undefined;
	formCha: number | undefined = undefined;
	formProvider = "anthropic";
	formSystemPrompt = "";
	formAllowedTools = "";
	formGlobs = "";
	formSuggestedTasks = "";
	formDescription = "";
	statusMessage = "";

	/** Populate form for editing an existing agent (called from host after loading companion JSON). */
	loadForEdit(displayName: string, blueprint: AgentBlueprint): void {
		this.editingName = displayName;
		this.formName = displayName;
		this.formPersona = blueprint.persona ?? "";
		this.formMood = blueprint.mood ?? "";
		this.formDomain = blueprint.domain ?? "";
		this.formInt = blueprint.attributes?.int;
		this.formCha = blueprint.attributes?.cha;
		this.formProvider = blueprint.ai?.provider ?? "anthropic";
		this.formSystemPrompt = blueprint.ai?.systemPrompt ?? "";
		this.formAllowedTools = (blueprint.ai?.allowedTools ?? []).join(", ");
		this.formGlobs = (blueprint.cursorRuleGlobs ?? []).join(", ");
		this.formSuggestedTasks = (blueprint.suggestedTasks ?? []).join("\n");
		this.formDescription = blueprint.description ?? "";
		this.statusMessage = "";
	}

	resetForNew(): void {
		this.editingName = "";
		this.formName = "";
		this.formPersona = "";
		this.formMood = "";
		this.formDomain = "";
		this.formInt = undefined;
		this.formCha = undefined;
		this.formProvider = "anthropic";
		this.formSystemPrompt = "";
		this.formAllowedTools = "";
		this.formGlobs = "";
		this.formSuggestedTasks = "";
		this.formDescription = "";
		this.statusMessage = "";
	}

	protected renderContent() {
		return html`
			<div class="overlay ${this.open ? "open" : ""}">
				<div class="head">
					<strong>Manage agents</strong>
					<button type="button" @click=${this.close}>Close</button>
				</div>
				<div class="body">
					<div class="list">
						${this.agents.length === 0
							? "No agents in vault."
							: this.agents.map((a) => html`
								<div class="agent-row">
									<button type="button" class="linkish" @click=${() => this.requestEdit(a.name)}>${a.name}</button>
									${a.provider ? html`<span> (${a.provider})</span>` : ""}
								</div>
							`)}
					</div>
					<div class="actions">
						<button type="button" @click=${this.newAgent}>New agent</button>
					</div>
					<label>Display name (unique)</label>
					<input type="text" .value=${this.formName} @input=${(e: Event) => { this.formName = (e.target as HTMLInputElement).value; }} ?disabled=${!!this.editingName} />
					<label>Persona</label>
					<input type="text" .value=${this.formPersona} @input=${(e: Event) => { this.formPersona = (e.target as HTMLInputElement).value; }} />
					<label>Mood</label>
					<input type="text" .value=${this.formMood} @input=${(e: Event) => { this.formMood = (e.target as HTMLInputElement).value; }} />
					<label>Domain</label>
					<input type="text" .value=${this.formDomain} @input=${(e: Event) => { this.formDomain = (e.target as HTMLInputElement).value; }} placeholder="e.g. development" />
					<div class="row">
						<div>
							<label>INT</label>
							<input type="number" .value=${this.formInt ?? ""} @input=${(e: Event) => {
			const v = (e.target as HTMLInputElement).value;
			this.formInt = v === "" ? undefined : Number(v);
		}} />
						</div>
						<div>
							<label>CHA</label>
							<input type="number" .value=${this.formCha ?? ""} @input=${(e: Event) => {
			const v = (e.target as HTMLInputElement).value;
			this.formCha = v === "" ? undefined : Number(v);
		}} />
						</div>
					</div>
					<label>Description (markdown body)</label>
					<textarea class="prompt-area" .value=${this.formDescription} @input=${(e: Event) => { this.formDescription = (e.target as HTMLTextAreaElement).value; }}></textarea>
					<label>AI provider (CLI)</label>
					<select .value=${this.formProvider} @change=${(e: Event) => { this.formProvider = (e.target as HTMLSelectElement).value; }}>
						<option value="anthropic">anthropic (Claude CLI)</option>
						<option value="cursor">cursor</option>
					</select>
					<label>System prompt (companion JSON)</label>
					<textarea class="prompt-area" .value=${this.formSystemPrompt} @input=${(e: Event) => { this.formSystemPrompt = (e.target as HTMLTextAreaElement).value; }}></textarea>
					<label>Allowed tools (comma-separated, optional)</label>
					<input type="text" .value=${this.formAllowedTools} @input=${(e: Event) => { this.formAllowedTools = (e.target as HTMLInputElement).value; }} placeholder="empty = no CLI restriction" />
					<label>Cursor rule globs (comma-separated, optional)</label>
					<input type="text" .value=${this.formGlobs} @input=${(e: Event) => { this.formGlobs = (e.target as HTMLInputElement).value; }} />
					<label>Suggested tasks (one pipe-line per row)</label>
					<textarea .value=${this.formSuggestedTasks} @input=${(e: Event) => { this.formSuggestedTasks = (e.target as HTMLTextAreaElement).value; }} placeholder="Task name|phase1,phase2"></textarea>
					<div class="actions">
						<button type="button" @click=${this.save}>Save</button>
						${this.editingName
			? html`<button type="button" class="danger" @click=${this.deleteAgent}>Delete</button>`
			: ""}
					</div>
					${this.statusMessage ? html`<div class="status ${this.statusMessage.startsWith("Error") ? "err" : ""}">${this.statusMessage}</div>` : ""}
				</div>
			</div>
		`;
	}

	private close = () => {
		this.open = false;
		this.dispatchEvent(new CustomEvent("manage-close", { bubbles: true, composed: true }));
	};

	private newAgent = () => {
		this.resetForNew();
	};

	private requestEdit(name: string) {
		this.open = true;
		this.dispatchEvent(new CustomEvent("agent-definition-request-edit", {
			bubbles: true,
			composed: true,
			detail: { displayName: name },
		}));
	}

	private buildBlueprintFromForm(): AgentBlueprint {
		const suggestedLines = this.formSuggestedTasks.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
		const tools = this.formAllowedTools.split(",").map((t) => t.trim()).filter(Boolean);
		const globs = this.formGlobs.split(",").map((g) => g.trim()).filter(Boolean);
		const attrs: Record<string, number> = {};
		if (typeof this.formInt === "number" && !Number.isNaN(this.formInt)) attrs.int = this.formInt;
		if (typeof this.formCha === "number" && !Number.isNaN(this.formCha)) attrs.cha = this.formCha;

		return {
			agentType: "ai",
			persona: this.formPersona.trim() || undefined,
			mood: this.formMood.trim() || undefined,
			domain: this.formDomain.trim() || undefined,
			description: this.formDescription.trim() || undefined,
			attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
			suggestedTasks: suggestedLines.length > 0 ? suggestedLines : undefined,
			ai: {
				provider: this.formProvider.trim() || "anthropic",
				systemPrompt: this.formSystemPrompt.trim() || undefined,
				allowedTools: tools.length > 0 ? tools : undefined,
				permissions: { mode: "trust" as const },
			},
			cursorRuleGlobs: globs.length > 0 ? globs : undefined,
		};
	}

	private save = () => {
		const name = this.formName.trim();
		if (!name) {
			this.statusMessage = "Error: name is required.";
			return;
		}
		this.dispatchEvent(new CustomEvent("agent-definition-save", {
			bubbles: true,
			composed: true,
			detail: {
				previousName: this.editingName || undefined,
				displayName: name,
				blueprint: this.buildBlueprintFromForm(),
			},
		}));
	};

	private deleteAgent = () => {
		if (!this.editingName) return;
		if (!confirm(`Delete agent "${this.editingName}"?`)) return;
		this.dispatchEvent(new CustomEvent("agent-definition-delete", {
			bubbles: true,
			composed: true,
			detail: { displayName: this.editingName },
		}));
	};
}

if (!customElements.get("flowti-agent-manage")) customElements.define("flowti-agent-manage", FlowtiAgentManage);
