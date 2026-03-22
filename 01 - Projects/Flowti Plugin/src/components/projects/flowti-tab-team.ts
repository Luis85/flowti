import { html, type PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { hubButton } from "../shared-styles.js";
import { css } from "lit";
import type { TeamRoleSlot, VaultAgentSummary, AgentBlueprint } from "../../domain/projects/types.js";
import { formatSkillsLineForEditor, parseSkillsLine, projectRoleNoteRelativePath } from "../../domain/projects/project-role-markdown.js";
import { teamRoleSlotDateRangeInvalid, teamRoleSlotsHaveInvalidDateRange } from "../../domain/projects/team-roster.js";

const styles = css`
	:host {
		--flowti-team-radius: 10px;
		display: block;
	}
	.team-page-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 10px;
	}
	.team-page-head__titles h3 {
		margin: 0 0 4px;
		font-size: 1.05em;
		font-weight: 600;
		color: var(--text-normal, #eaeaea);
		letter-spacing: -0.01em;
	}
	.team-page-head__subtitle {
		margin: 0;
		font-size: var(--flowti-font-sm, 0.82em);
		color: var(--text-muted, #888);
		line-height: 1.4;
		max-width: 42em;
	}
	.hub-inline-progress {
		margin-bottom: 14px;
		border-radius: var(--flowti-team-radius);
		border: 1px solid color-mix(in srgb, var(--interactive-accent, #7c3aed) 35%, var(--background-modifier-border, #333));
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 6%, var(--background-secondary, #1c1c1c));
		overflow: hidden;
	}
	.hub-inline-progress__head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--background-modifier-border, #333);
		font-size: var(--flowti-font-sm, 0.85em);
		font-weight: 500;
		color: var(--interactive-accent, #c4b5fd);
	}
	.hub-inline-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid color-mix(in srgb, var(--interactive-accent, #7c3aed) 35%, transparent);
		border-top-color: var(--interactive-accent, #a78bfa);
		border-radius: 50%;
		animation: teamspin 0.75s linear infinite;
		flex-shrink: 0;
	}
	@keyframes teamspin {
		to {
			transform: rotate(360deg);
		}
	}
	.hub-inline-progress__label {
		flex: 1;
		min-width: 0;
		line-height: 1.35;
	}
	.hub-inline-progress__log {
		margin: 0;
		padding: 8px 12px 10px;
		max-height: 140px;
		overflow: auto;
		font-family: var(--font-monospace, ui-monospace, monospace);
		font-size: 11px;
		line-height: 1.45;
		color: color-mix(in srgb, var(--text-normal, #ddd) 88%, var(--text-muted, #999));
		background: var(--background-primary, #141414);
		white-space: pre-wrap;
		word-break: break-word;
	}
	.lead {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
		line-height: 1.45;
		margin: 0 0 14px;
	}
	.lead code {
		font-size: 0.92em;
		padding: 1px 5px;
		border-radius: var(--hub-radius, 6px);
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
	.summary-bar .summary-hint {
		flex-basis: 100%;
		font-size: 0.92em;
		color: color-mix(in srgb, var(--color-yellow, #e5a00d) 75%, var(--text-muted, #999));
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		padding: 10px 12px;
		border-radius: var(--flowti-team-radius);
		background: color-mix(in srgb, var(--background-secondary, #262626) 92%, transparent);
		border: 1px solid var(--background-modifier-border, #333);
	}
	.toolbar__spacer {
		flex: 1;
		min-width: 8px;
	}
	.hub-btn--danger {
		border-color: color-mix(in srgb, var(--color-red, #e53935) 55%, transparent);
		color: var(--color-red, #f87171);
	}
	.hub-btn--danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
	}
	.card {
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--flowti-team-radius);
		padding: 14px 16px;
		margin-bottom: 14px;
		background: var(--background-secondary, #1a1a1a);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--background-modifier-border, #333) 70%, var(--text-muted, #666));
	}
	.card--creating {
		border-color: color-mix(in srgb, var(--interactive-accent, #7c3aed) 55%, var(--background-modifier-border, #333));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent, #7c3aed) 18%, transparent);
		animation: cardcreating 1.6s ease-in-out infinite;
	}
	@keyframes cardcreating {
		0%,
		100% {
			box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent, #7c3aed) 12%, transparent);
		}
		50% {
			box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent, #7c3aed) 28%, transparent);
		}
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
	input[type="number"],
	input[type="date"],
	select,
	textarea {
		font-size: var(--flowti-font-sm, 0.85em);
		padding: 6px 10px;
		background: var(--background-primary, #1e1e1e);
		color: var(--text-normal, #ddd);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
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
	.staffing-row__inputs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
	}
	.staffing-row__inputs input[type="number"] {
		width: 7rem;
		max-width: 100%;
	}
	.staffing-dates {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 12px;
	}
	.staffing-date-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.staffing-date-label {
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
	}
	.staffing-dates input[type="date"] {
		width: auto;
		min-width: 10rem;
	}
	.staffing-dates__sep {
		color: var(--text-muted, #777);
		font-size: var(--flowti-font-sm, 0.85em);
		user-select: none;
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
		border-radius: var(--hub-radius, 6px);
		background: color-mix(in srgb, var(--color-yellow, #e5a00d) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-yellow, #e5a00d) 25%, transparent);
	}
	.json-error {
		color: var(--color-red, #f87171);
		font-size: 0.8em;
		margin: 6px 0 0;
	}
	.field-warn {
		color: color-mix(in srgb, var(--color-yellow, #e5a00d) 85%, var(--text-normal, #ddd));
		font-size: var(--flowti-font-sm, 0.85em);
		margin: 6px 0 0;
		line-height: 1.35;
	}
	.empty {
		padding: 24px 16px;
		text-align: center;
		border: 1px dashed color-mix(in srgb, var(--background-modifier-border, #444) 85%, var(--interactive-accent, #7c3aed));
		border-radius: var(--flowti-team-radius);
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
		line-height: 1.55;
	}
	.materialize-box {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--background-modifier-border, #333);
	}
	.materialize-box__label {
		font-size: 0.72em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #888);
		margin: 0 0 8px;
	}
	.materialize-box__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.creating-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--flowti-font-sm, 0.8em);
		color: var(--interactive-accent, #c4b5fd);
		margin-bottom: 8px;
	}
	.creating-pill__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--interactive-accent, #a78bfa);
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
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
		/** True while project hub runs an async action (save roster, create agent, …). */
		actionsLocked: { type: Boolean, attribute: "actions-locked" },
		hubBusy: { type: Boolean },
		hubBusyLabel: { type: String },
		hubOutputLines: { type: Array },
		agentCreationContext: { type: Object },
	};

	static styles = [tokens, hubButton, styles];

	projectName = "";
	roleSlots: TeamRoleSlot[] = [];
	vaultAgents: VaultAgentSummary[] = [];
	actionsLocked = false;
	hubBusy = false;
	hubBusyLabel = "";
	hubOutputLines: string[] = [];
	agentCreationContext: { roleId: string; agentName: string } | null = null;
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

	protected updated(_changed: PropertyValues): void {
		super.updated(_changed);
		if (this.actionsLocked) this.setAttribute("aria-busy", "true");
		else this.removeAttribute("aria-busy");
	}

	private get assignedCount(): number {
		return this._slots.filter((s) => s.assignee?.trim()).length;
	}

	private get totalFtePlanned(): number {
		return this._slots.reduce((acc, s) => acc + (typeof s.roleFte === "number" && Number.isFinite(s.roleFte) ? s.roleFte : 0), 0);
	}

	private get anyRoleHasFte(): boolean {
		return this._slots.some((s) => s.roleFte != null && Number.isFinite(s.roleFte));
	}

	private get rolesMissingFteCount(): number {
		return this._slots.filter((s) => s.roleFte == null || !Number.isFinite(s.roleFte)).length;
	}

	private get dateRangeWarningCount(): number {
		return this._slots.filter((s) => teamRoleSlotDateRangeInvalid(s)).length;
	}

	private formatFteTotal(): string {
		if (!this.anyRoleHasFte) return "—";
		const t = this.totalFtePlanned;
		return t % 1 === 0 ? String(t) : t.toFixed(2);
	}

	protected renderContent() {
		const nAgents = this.vaultAgents.length;
		const nSlots = this._slots.length;
		return html`
			<header class="team-page-head">
				<div class="team-page-head__titles">
					<h3>Team roster</h3>
					<p class="team-page-head__subtitle">
						Staff roles as markdown notes, assign people, or materialize new vault agents. Progress and CLI output appear below while an operation runs.
					</p>
				</div>
			</header>
			${this.renderHubProgress()}
			<p class="lead">
				Each <strong>role</strong> is a <code>ProjectRole</code> note under <code>team/roles/</code> (title, need, <strong>FTE</strong>, optional dates, skills, narrative).
				<code>flowti.config.json</code> keeps the slot list and assignees. <strong>Save roster</strong> writes every note and runs <code>agent:dashboard-sync</code>.
				Assign vault agents or <strong>Create agent from role</strong> (skills/description from the note; optional <strong>blueprint JSON</strong> overrides).
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
						<span><strong>${this.formatFteTotal()}</strong> Σ FTE</span>
						${this.rolesMissingFteCount > 0
							? html`<span class="summary-hint">${this.rolesMissingFteCount} role${this.rolesMissingFteCount === 1 ? "" : "s"} without FTE — optional, but helps capacity planning.</span>`
							: ""}
						${this.dateRangeWarningCount > 0
							? html`<span class="summary-hint">${this.dateRangeWarningCount} role${this.dateRangeWarningCount === 1 ? "" : "s"}: end date before start — check dates below.</span>`
							: ""}
					</div>
				`
				: ""}
			<div class="toolbar">
				<button
					type="button"
					class="hub-btn"
					title="Reload Agent definitions from the vault folder"
					?disabled="${this.actionsLocked}"
					@click="${this.refreshAgents}"
				>
					Refresh agent list
				</button>
				<button type="button" class="hub-btn" title="Add another staffing role to this project" ?disabled="${this.actionsLocked}" @click="${this.addSlot}">
					Add role
				</button>
				<span class="toolbar__spacer"></span>
				<button
					type="button"
					class="hub-btn hub-btn--primary"
					title="Write role notes, flowti.config.json, and sync the agent dashboard"
					?disabled="${this.actionsLocked}"
					@click="${this.saveAll}"
				>
					Save roster
				</button>
			</div>
			${nSlots === 0
				? html`<div class="empty">No role slots yet. Use <strong>Add role</strong> to capture requirements, then assign someone or create a new agent from the role.</div>`
				: this._slots.map((slot) => this.renderCard(slot))}
		`;
	}

	private renderHubProgress() {
		const lines = [...(this.hubOutputLines ?? [])].slice(-12);
		if (!this.hubBusy && lines.length === 0) return "";
		const body = lines.length > 0 ? lines.join("\n") : "Waiting for the next step…";
		const label = this.hubBusy ? (this.hubBusyLabel || "Working…") : "Recent project CLI output";
		return html`
			<div class="hub-inline-progress" role="status" aria-live="polite" aria-busy="${this.hubBusy}">
				<div class="hub-inline-progress__head">
					${this.hubBusy ? html`<span class="hub-inline-spinner" aria-hidden="true"></span>` : ""}
					<span class="hub-inline-progress__label">${label}</span>
				</div>
				<pre class="hub-inline-progress__log">${body}</pre>
			</div>
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
		const fteId = `${sid}-fte`;
		const startId = `${sid}-start`;
		const endId = `${sid}-end`;
		const rolePath = slot.roleNotePath ?? projectRoleNoteRelativePath(this.projectName, slot.id);
		const hasAssignee = Boolean(slot.assignee?.trim());
		const canCreate = createName.trim().length > 0;

		const lock = this.actionsLocked;
		const staffingHintId = `${sid}-staffing-hint`;
		const badDates = teamRoleSlotDateRangeInvalid(slot);
		const creatingHere = this.agentCreationContext?.roleId === slot.id;

		return html`
			<div class="card ${creatingHere ? "card--creating" : ""}" data-role="${slot.id}">
				<div class="card-title">Role</div>
				<div class="field">
					<label for="${titleId}">Role title</label>
					<input
						id="${titleId}"
						type="text"
						.value="${slot.title}"
						autocomplete="off"
						?disabled="${lock}"
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
						?disabled="${lock}"
						@change="${(e: Event) => this.patchSlot(slot.id, { need: (e.target as HTMLInputElement).value })}"
					/>
				</div>
				<div class="field staffing-row">
					<label for="${fteId}">Staffing</label>
					<div class="staffing-row__inputs">
						<input
							id="${fteId}"
							type="number"
							min="0"
							step="0.25"
							.value="${slot.roleFte != null && Number.isFinite(slot.roleFte) ? String(slot.roleFte) : ""}"
							placeholder="FTE"
							aria-describedby="${staffingHintId}"
							?disabled="${lock}"
							@change="${(e: Event) => this.onFteChange(slot.id, (e.target as HTMLInputElement).value)}"
						/>
						<div class="staffing-dates">
							<div class="staffing-date-field">
								<label class="staffing-date-label" for="${startId}">Start</label>
								<input
									id="${startId}"
									type="date"
									.value="${slot.roleStart ?? ""}"
									?disabled="${lock}"
									@change="${(e: Event) => this.onDateField(slot.id, "roleStart", (e.target as HTMLInputElement).value)}"
								/>
							</div>
							<span class="staffing-dates__sep" aria-hidden="true">→</span>
							<div class="staffing-date-field">
								<label class="staffing-date-label" for="${endId}">End</label>
								<input
									id="${endId}"
									type="date"
									.value="${slot.roleEnd ?? ""}"
									?disabled="${lock}"
									@change="${(e: Event) => this.onDateField(slot.id, "roleEnd", (e.target as HTMLInputElement).value)}"
								/>
							</div>
						</div>
					</div>
					<p id="${staffingHintId}" class="muted" style="margin:6px 0 0">
						Full-time equivalent (optional). Dates use your locale control but are stored as ISO in the note.
					</p>
					${badDates ? html`<p class="field-warn" role="alert">End date is before start date.</p>` : ""}
				</div>
				<div class="field">
					<label for="${skillsId}">Skills (semicolon-separated)</label>
					<input
						id="${skillsId}"
						type="text"
						.value="${formatSkillsLineForEditor(slot.roleSkills ?? [])}"
						autocomplete="off"
						placeholder="e.g. Requirements Engineering 5; Team Player; IREB Certified"
						?disabled="${lock}"
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
						?disabled="${lock}"
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
						?disabled="${lock}"
						@change="${(e: Event) => this.patchSlot(slot.id, { roleBody: (e.target as HTMLTextAreaElement).value })}"
					></textarea>
				</div>
				<p class="muted" style="margin:0 0 8px">
					Role note: <code style="font-size:0.9em">${rolePath}</code>
					<button
						type="button"
						class="hub-btn hub-btn--compact"
						title="Open this role note in the vault"
						?disabled="${lock || !this.projectName}"
						@click="${() => this.openRoleNote(rolePath)}"
					>
						Open note
					</button>
				</p>
				<details class="bp-details" ?open="${Boolean(slot.blueprint && Object.keys(slot.blueprint).length > 0)}">
					<summary>Agent blueprint (JSON)</summary>
					<p class="muted" style="margin:8px 0 6px">
						Power users: override skills, description, goals, or attributes when materializing an agent. Invalid JSON blocks save until fixed.
					</p>
					<label class="sr-only" for="${bpId}">Blueprint JSON for ${slot.title}</label>
					<textarea
						id="${bpId}"
						class="bp"
						.value="${bpText}"
						spellcheck="false"
						?disabled="${lock}"
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
						?disabled="${lock}"
						@change="${(e: Event) => this.onAssignSelect(slot.id, (e.target as HTMLSelectElement).value)}"
					>
						<option value="">Assign existing agent…</option>
						${this.vaultAgents.map((a) => html`<option value="${a.name}" ?selected="${a.name === slot.assignee}">${a.name}</option>`)}
					</select>
					<button
						type="button"
						class="hub-btn"
						?disabled="${!hasAssignee || lock}"
						title="Remove this assignee and update the roster (saves immediately)"
						@click="${() => this.clearAssignee(slot.id)}"
					>
						Unassign
					</button>
				</div>
				<div class="materialize-box">
					<p class="materialize-box__label">New vault agent</p>
					${creatingHere
						? html`<div class="creating-pill" role="status">
								<span class="creating-pill__dot" aria-hidden="true"></span>
								<span>Creating <strong>${this.agentCreationContext?.agentName ?? "agent"}</strong> — watch the log above for steps.</span>
						  </div>`
						: ""}
					<div class="materialize-box__row">
						<label class="sr-only" for="${createId}">New agent display name for ${slot.title}</label>
						<input
							id="${createId}"
							type="text"
							style="flex:1;min-width:140px;max-width:280px"
							placeholder="Display name (e.g. Alex — Product)"
							.value="${createName}"
							autocomplete="off"
							?disabled="${lock}"
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
							class="hub-btn hub-btn--primary"
							?disabled="${!canCreate || lock}"
							title="Create an Agent note from this role, assign it, save roster, and sync the dashboard"
							@click="${() => this.emitCreate(slot.id)}"
						>
							Create agent from role
						</button>
						<button
							type="button"
							class="hub-btn hub-btn--danger"
							title="Remove this role and its ProjectRole note from the project"
							?disabled="${lock}"
							@click="${() => this.removeSlot(slot.id)}"
						>
							Remove role
						</button>
					</div>
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

	private onFteChange(id: string, raw: string): void {
		const t = raw.trim();
		if (!t) {
			this.patchSlot(id, { roleFte: undefined });
			return;
		}
		const n = Number(t);
		this.patchSlot(id, { roleFte: Number.isFinite(n) && n >= 0 ? n : undefined });
	}

	private onDateField(id: string, key: "roleStart" | "roleEnd", value: string): void {
		const v = value.trim();
		this.patchSlot(id, { [key]: v ? v : undefined } as Partial<TeamRoleSlot>);
	}

	private openRoleNote(vaultRelativePath: string): void {
		this.dispatchEvent(new CustomEvent("open-project-note", { detail: { path: vaultRelativePath }, bubbles: true, composed: true }));
	}

	private clearAssignee(id: string): void {
		if (this.actionsLocked) return;
		this._slots = this._slots.map((s) => {
			if (s.id !== id) return s;
			const next = { ...s };
			delete (next as { assignee?: string }).assignee;
			return next as TeamRoleSlot;
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
		if (this.actionsLocked || !name) return;
		this.patchSlot(roleId, { assignee: name });
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private addSlot(): void {
		if (this.actionsLocked) return;
		this._slots = [...this._slots, { id: newRoleId(), title: "New role", need: "" }];
		this.requestUpdate();
	}

	private removeSlot(id: string): void {
		if (this.actionsLocked) return;
		const ok = globalThis.confirm(
			"Remove this role from the project? Its ProjectRole note will be deleted and the roster will be saved.",
		);
		if (!ok) return;
		this._slots = this._slots.filter((s) => s.id !== id);
		const rest = { ...this._createNameByRole };
		delete rest[id];
		this._createNameByRole = rest;
		this.requestUpdate();
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private saveAll(): void {
		if (this.actionsLocked) return;
		if (this._blueprintErrorRoleId) {
			this.dispatchEvent(
				new CustomEvent("team-roster-error", { detail: { message: "Fix invalid blueprint JSON before saving the roster." }, bubbles: true, composed: true }),
			);
			return;
		}
		if (teamRoleSlotsHaveInvalidDateRange(this._slots)) {
			this.dispatchEvent(
				new CustomEvent("team-roster-error", {
					detail: { message: "One or more roles have an end date before the start date — fix dates or clear them before saving." },
					bubbles: true,
					composed: true,
				}),
			);
			return;
		}
		this.dispatchEvent(new CustomEvent("team-roster-save", { detail: { slots: this._slots }, bubbles: true, composed: true }));
	}

	private refreshAgents(): void {
		if (this.actionsLocked) return;
		this.dispatchEvent(new CustomEvent("team-refresh-agents", { bubbles: true, composed: true }));
	}

	private emitCreate(roleId: string): void {
		if (this.actionsLocked) return;
		const name = (this._createNameByRole[roleId] ?? "").trim();
		if (!name) {
			this.dispatchEvent(new CustomEvent("team-roster-error", { detail: { message: "Enter a display name before creating an agent." }, bubbles: true, composed: true }));
			return;
		}
		this.dispatchEvent(
			new CustomEvent("team-create-agent", {
				detail: { roleId, agentName: name, slots: this._slots },
				bubbles: true,
				composed: true,
			}),
		);
	}
}

if (!customElements.get("flowti-tab-team")) customElements.define("flowti-tab-team", FlowtiTabTeam);
