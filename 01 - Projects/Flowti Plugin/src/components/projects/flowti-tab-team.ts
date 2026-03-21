import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";
import type { TeamRoleSlot, VaultAgentSummary, AgentBlueprint } from "../../domain/projects/types.js";
import { formatSkillsLineForEditor, parseSkillsLine, projectRoleNoteRelativePath } from "../../domain/projects/project-role-markdown.js";

const styles = css`
	:host {
		--flowti-team-radius: 8px;
	}
	h3 {
		font-size: 1em;
		margin: 0 0 6px;
		color: var(--text-normal, #ddd);
		font-weight: 600;
	}
	.lead {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
		line-height: 1.45;
		margin: 0 0 12px;
	}
	.lead code {
		font-size: 0.92em;
		padding: 1px 5px;
		border-radius: 4px;
		background: var(--background-modifier-hover, #333);
	}
	.summary-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 14px 20px;
		margin-bottom: 14px;
		padding: 10px 12px;
		border-radius: var(--flowti-team-radius);
		border: 1px solid var(--background-modifier-border, #333);
		background: color-mix(in srgb, var(--background-secondary, #262626) 80%, transparent);
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
	}
	.summary-bar strong {
		color: var(--text-normal, #ddd);
		font-weight: 500;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}
	.btn {
		padding: 6px 14px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		transition: background 0.12s ease, border-color 0.12s ease;
	}
	.btn:hover:not(:disabled) {
		background: var(--background-modifier-hover, #333);
	}
	.btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.btn--primary {
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 22%, var(--background-secondary, #262626));
		border-color: var(--interactive-accent, #7c3aed);
		color: var(--text-normal, #eee);
	}
	.btn--primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 35%, var(--background-secondary, #262626));
	}
	.btn--danger {
		border-color: color-mix(in srgb, var(--color-red, #e53935) 55%, transparent);
		color: var(--color-red, #f87171);
	}
	.btn--danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
	}
	.card {
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--flowti-team-radius);
		padding: 12px 14px;
		margin-bottom: 12px;
		background: var(--background-secondary, #1a1a1a);
	}
	.card-title {
		margin: 0 0 10px;
		font-size: 0.8em;
		font-weight: 600;
		color: var(--text-muted, #999);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.field {
		margin-bottom: 10px;
	}
	.field label,
	.sr-only {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
		display: block;
		margin-bottom: 4px;
	}
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
	input[type="text"],
	select,
	textarea {
		font-size: var(--flowti-font-sm, 0.85em);
		padding: 6px 10px;
		background: var(--background-primary, #1e1e1e);
		color: var(--text-normal, #ddd);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: 6px;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}
	input:focus-visible,
	select:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 1px;
	}
	select.assign-select {
		max-width: 220px;
		width: auto;
		flex: 1;
		min-width: 140px;
	}
	textarea.bp {
		min-height: 88px;
		font-family: var(--font-monospace, ui-monospace, monospace);
		line-height: 1.35;
	}
	textarea.role-body {
		min-height: 120px;
		line-height: 1.45;
	}
	details.bp-details {
		margin-top: 4px;
	}
	details.bp-details summary {
		cursor: pointer;
		user-select: none;
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--interactive-accent, #a78bfa);
		list-style: none;
	}
	details.bp-details summary::-webkit-details-marker {
		display: none;
	}
	details.bp-details summary::before {
		content: "▸ ";
		display: inline-block;
		transition: transform 0.15s ease;
	}
	details.bp-details[open] summary::before {
		transform: rotate(90deg);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
	}
	.row--tight {
		margin-top: 4px;
	}
	.badge {
		font-size: 0.75em;
		padding: 3px 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 18%, transparent);
		color: var(--interactive-accent, #c4b5fd);
		font-weight: 500;
	}
	.unassigned {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #777);
		font-style: italic;
	}
	.muted {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
		line-height: 1.4;
	}
	.hint-warn {
		font-size: var(--flowti-font-sm, 0.85em);
		color: color-mix(in srgb, var(--color-yellow, #e5a00d) 90%, var(--text-normal, #ddd));
		margin: 0 0 12px;
		padding: 8px 10px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-yellow, #e5a00d) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-yellow, #e5a00d) 25%, transparent);
	}
	.json-error {
		color: var(--color-red, #f87171);
		font-size: 0.8em;
		margin: 6px 0 0;
	}
	.empty {
		padding: 20px 14px;
		text-align: center;
		border: 1px dashed var(--background-modifier-border, #444);
		border-radius: var(--flowti-team-radius);
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
		line-height: 1.5;
	}
`;

function newRoleId(): string {
	return `role-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSlots(slots: readonly TeamRoleSlot[]): TeamRoleSlot[] {
	return JSON.parse(JSON.stringify(slots)) as TeamRoleSlot[];
}

export class FlowtiTabTeam extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		roleSlots: { type: Array },
		vaultAgents: { type: Array },
	};

	static styles = [tokens, styles];

	projectName = "";
	roleSlots: TeamRoleSlot[] = [];
	vaultAgents: VaultAgentSummary[] = [];
	private _slots: TeamRoleSlot[] = [];
	private _createNameByRole: Record<string, string> = {};
	/** Role id whose blueprint JSON failed to parse (inline error). */
	private _blueprintErrorRoleId: string | null = null;

	willUpdate(changed: Map<PropertyKey, unknown>): void {
		if (changed.has("roleSlots")) {
			this._slots = cloneSlots(this.roleSlots ?? []);
			this._blueprintErrorRoleId = null;
		}
	}

	private get assignedCount(): number {
		return this._slots.filter((s) => s.assignee?.trim()).length;
	}

	protected renderContent() {
		const nAgents = this.vaultAgents.length;
		const nSlots = this._slots.length;
		return html`
			<h3>Team roster</h3>
			<p class="lead">
				Define <strong>role profiles</strong> (title, need, skills, description). Each role is saved as a <code>ProjectRole</code> markdown file under
				<code>team/roles/</code> in the project folder; <code>flowti.config.json</code> stores the slot, assignee, and path. Creating an agent copies skills and
				description into the new Agent note; an optional <strong>blueprint JSON</strong> overrides those fields when set. Assign existing vault agents or create a note under
				<code>03 - Resources/Agents</code>. Saving runs <code>agent:dashboard-sync</code>.
			</p>
			${nAgents === 0
				? html`<p class="hint-warn">No agents found under <code>03 - Resources/Agents</code>. Create an agent from a role, or add Agent notes there — then use <strong>Refresh agent list</strong>.</p>`
				: ""}
			${nSlots > 0
				? html`
					<div class="summary-bar" role="status" aria-live="polite">
						<span><strong>${nSlots}</strong> role${nSlots === 1 ? "" : "s"}</span>
						<span><strong>${this.assignedCount}</strong> filled</span>
						<span><strong>${nAgents}</strong> vault agent${nAgents === 1 ? "" : "s"}</span>
					</div>
				`
				: ""}
			<div class="toolbar">
				<button type="button" class="btn" title="Reload Agent definitions from the vault folder" @click="${this.refreshAgents}">Refresh agent list</button>
				<button type="button" class="btn" title="Add another staffing role to this project" @click="${this.addSlot}">Add role</button>
				<button
					type="button"
					class="btn btn--primary"
					title="Write role slots and roster to flowti.config.json and sync the agent dashboard"
					@click="${this.saveAll}"
				>
					Save roster
				</button>
			</div>
			${nSlots === 0
				? html`<div class="empty">No role slots yet. Add a role to capture requirements in markdown, then assign someone or create a new agent.</div>`
				: this._slots.map((slot) => this.renderCard(slot))}
		`;
	}

	private renderCard(slot: TeamRoleSlot) {
		const createName = this._createNameByRole[slot.id] ?? "";
		const bpText = slot.blueprint ? JSON.stringify(slot.blueprint, null, 2) : "";
		const sid = `team-${slot.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
		const assignId = `${sid}-assign`;
		const titleId = `${sid}-title`;
		const needId = `${sid}-need`;
		const createId = `${sid}-create-name`;
		const bpId = `${sid}-blueprint`;
		const skillsId = `${sid}-skills`;
		const summaryId = `${sid}-summary`;
		const bodyId = `${sid}-body`;
		const rolePath = slot.roleNotePath ?? projectRoleNoteRelativePath(this.projectName, slot.id);
		const hasAssignee = Boolean(slot.assignee?.trim());
		const canCreate = createName.trim().length > 0;

		return html`
			<div class="card" data-role="${slot.id}">
				<div class="card-title">Role</div>
				<div class="field">
					<label for="${titleId}">Role title</label>
					<input
						id="${titleId}"
						type="text"
						.value="${slot.title}"
						autocomplete="off"
						@change="${(e: Event) => this.patchSlot(slot.id, { title: (e.target as HTMLInputElement).value })}"
					/>
				</div>
				<div class="field">
					<label for="${needId}">Need (what this role covers)</label>
					<input
						id="${needId}"
						type="text"
						.value="${slot.need}"
						autocomplete="off"
						placeholder="e.g. Owns API design and review"
						@change="${(e: Event) => this.patchSlot(slot.id, { need: (e.target as HTMLInputElement).value })}"
					/>
				</div>
				<div class="field">
					<label for="${skillsId}">Skills (semicolon-separated)</label>
					<input
						id="${skillsId}"
						type="text"
						.value="${formatSkillsLineForEditor(slot.roleSkills ?? [])}"
						autocomplete="off"
						placeholder="e.g. Requirements Engineering 5; Team Player; IREB Certified"
						@change="${(e: Event) => this.onSkillsLine(slot.id, (e.target as HTMLInputElement).value)}"
					/>
				</div>
				<div class="field">
					<label for="${summaryId}">Short description (frontmatter)</label>
					<input
						id="${summaryId}"
						type="text"
						.value="${slot.roleSummary ?? ""}"
						autocomplete="off"
						placeholder="One line summary for the role note"
						@change="${(e: Event) => this.patchSlot(slot.id, { roleSummary: (e.target as HTMLInputElement).value })}"
					/>
				</div>
				<div class="field">
					<label for="${bodyId}">Description (markdown body)</label>
					<textarea
						id="${bodyId}"
						class="role-body"
						.value="${slot.roleBody ?? ""}"
						spellcheck="true"
						placeholder="Longer context, responsibilities, expectations…"
						@change="${(e: Event) => this.patchSlot(slot.id, { roleBody: (e.target as HTMLTextAreaElement).value })}"
					></textarea>
				</div>
				<p class="muted" style="margin:0 0 8px">
					Role note: <code style="font-size:0.9em">${rolePath}</code>
					<button type="button" class="btn" style="margin-left:8px;padding:4px 10px;font-size:0.85em" @click="${() => this.openRoleNote(rolePath)}">Open note</button>
				</p>
				<details class="bp-details" ?open="${Boolean(slot.blueprint && Object.keys(slot.blueprint).length > 0)}">
					<summary>Agent blueprint (JSON)</summary>
					<p class="muted" style="margin:8px 0 6px">
						Optional override. When creating an agent, values here replace the role note’s skills/description. Invalid JSON is not saved until fixed.
					</p>
					<label class="sr-only" for="${bpId}">Blueprint JSON for ${slot.title}</label>
					<textarea
						id="${bpId}"
						class="bp"
						.value="${bpText}"
						spellcheck="false"
						@change="${(e: Event) => this.onBlueprintJson(slot.id, (e.target as HTMLTextAreaElement).value)}"
					></textarea>
					${this._blueprintErrorRoleId === slot.id ? html`<p class="json-error" role="alert">Invalid JSON — fix the blueprint or clear the field.</p>` : ""}
				</details>
				<div class="row">
					${hasAssignee ? html`<span class="badge" title="Agent assigned to this role">${slot.assignee}</span>` : html`<span class="unassigned">Unassigned</span>`}
					<label class="sr-only" for="${assignId}">Assign existing agent to ${slot.title}</label>
					<select
						id="${assignId}"
						class="assign-select"
						aria-label="Assign existing vault agent to ${slot.title}"
						@change="${(e: Event) => this.onAssignSelect(slot.id, (e.target as HTMLSelectElement).value)}"
					>
						<option value="">Assign existing agent…</option>
						${this.vaultAgents.map((a) => html`<option value="${a.name}" ?selected="${a.name === slot.assignee}">${a.name}</option>`)}
					</select>
					<button
						type="button"
						class="btn"
						?disabled="${!hasAssignee}"
						title="Remove this assignee from the role and update the project roster"
						@click="${() => this.clearAssignee(slot.id)}"
					>
						Unassign
					</button>
				</div>
				<div class="row row--tight">
					<label class="sr-only" for="${createId}">New agent display name for ${slot.title}</label>
					<input
						id="${createId}"
						type="text"
						style="flex:1;min-width:140px;max-width:280px"
						placeholder="New agent display name"
						.value="${createName}"
						autocomplete="off"
						@input="${(e: Event) => {
							this._createNameByRole = { ...this._createNameByRole, [slot.id]: (e.target as HTMLInputElement).value };
							this.requestUpdate();
						}}"
						@keydown="${(e: KeyboardEvent) => {
							if (e.key === "Enter") {
								e.preventDefault();
								this.emitCreate(slot.id);
							}
						}}"
					/>
					<button
						type="button"
						class="btn btn--primary"
						?disabled="${!canCreate}"
						title="Create Agent note from role requirements (and optional blueprint) and assign to this role"
						@click="${() => this.emitCreate(slot.id)}"
					>
						Create agent from role
					</button>
					<button
						type="button"
						class="btn btn--danger"
						title="Remove this role slot from the project (saves immediately)"
						@click="${() => this.removeSlot(slot.id)}"
					>
						Remove role
					</button>
				</div>
			</div>
		`;
	}

	private patchSlot(id: string, patch: Partial<TeamRoleSlot>): void {
		this._slots = this._slots.map((s) => (s.id === id ? { ...s, ...patch } : s));
		this.requestUpdate();
	}

	private onSkillsLine(id: string, raw: string): void {
		const skills = parseSkillsLine(raw);
		this.patchSlot(id, { roleSkills: skills.length > 0 ? skills : undefined });
	}

	private openRoleNote(vaultRelativePath: string): void {
		this.dispatchEvent(new CustomEvent("open-project-note", { detail: { path: vaultRelativePath }, bubbles: true, composed: true }));
	}

	private clearAssignee(id: string): void {
		this._slots = this._slots.map((s) => {
			if (s.id !== id) return s;
			const { assignee: _a, ...rest } = s;
			return rest as TeamRoleSlot;
		});
		this.requestUpdate();
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private onBlueprintJson(id: string, raw: string): void {
		const t = raw.trim();
		if (!t) {
			this._blueprintErrorRoleId = null;
			this.patchSlot(id, { blueprint: undefined });
			return;
		}
		try {
			const bp = JSON.parse(t) as AgentBlueprint;
			this._blueprintErrorRoleId = null;
			this.patchSlot(id, { blueprint: bp });
		} catch {
			this._blueprintErrorRoleId = id;
			this.requestUpdate();
			this.dispatchEvent(
				new CustomEvent("team-roster-error", { detail: { message: "Blueprint JSON is invalid — check the role’s blueprint field." }, bubbles: true, composed: true }),
			);
		}
	}

	private onAssignSelect(roleId: string, name: string): void {
		if (!name) return;
		this.patchSlot(roleId, { assignee: name });
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private addSlot(): void {
		this._slots = [...this._slots, { id: newRoleId(), title: "New role", need: "" }];
		this.requestUpdate();
	}

	private removeSlot(id: string): void {
		this._slots = this._slots.filter((s) => s.id !== id);
		const rest = { ...this._createNameByRole };
		delete rest[id];
		this._createNameByRole = rest;
		this.requestUpdate();
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private saveAll(): void {
		if (this._blueprintErrorRoleId) {
			this.dispatchEvent(
				new CustomEvent("team-roster-error", { detail: { message: "Fix invalid blueprint JSON before saving the roster." }, bubbles: true, composed: true }),
			);
			return;
		}
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private refreshAgents(): void {
		this.dispatchEvent(new CustomEvent("team-refresh-agents", { bubbles: true, composed: true }));
	}

	private emitCreate(roleId: string): void {
		const name = (this._createNameByRole[roleId] ?? "").trim();
		if (!name) {
			this.dispatchEvent(new CustomEvent("team-roster-error", { detail: { message: "Enter a display name before creating an agent." }, bubbles: true, composed: true }));
			return;
		}
		this.dispatchEvent(new CustomEvent("team-create-agent", { detail: { roleId, agentName: name }, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-team")) customElements.define("flowti-tab-team", FlowtiTabTeam);
