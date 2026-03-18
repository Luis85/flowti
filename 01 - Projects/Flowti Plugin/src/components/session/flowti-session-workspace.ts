import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge } from '../shared-styles.js';

// Side-effect imports to register sub-components
import './flowti-session-timer.js';
import './flowti-session-energy.js';
import './flowti-session-goals.js';
import './flowti-session-tasks.js';
import './flowti-session-notes.js';
import './flowti-session-activity.js';
import './flowti-session-context.js';
import './flowti-session-decisions.js';
import './flowti-session-reflections.js';
import './flowti-session-outputs.js';
import './flowti-session-overload.js';
import './flowti-session-closure.js';

/**
 * Intelligence stats item shape for the activity summary row.
 */
interface IntelligenceStats {
	filesModified: number;
	artifactsProduced: number;
	tasksCompleted: number;
	eventsEmitted: number;
	activeTimeMs: number;
	pauseTimeMs: number;
}

/**
 * Train data shape for the closure panel.
 */
interface TrainClosureData {
	title: string;
	trainType?: string;
	thoughtCount: number;
	branchCount: number;
	mergeCount: number;
	elapsed: string;
	keyThoughts: string[];
}

/**
 * Main session workspace orchestrator Lit component.
 *
 * Composes all session sub-panels based on the session's current state.
 * Inlines simple rendering (guiding questions, intelligence stats,
 * file links, header) and delegates complex panels to sub-components.
 *
 * @property session - The full session data object (set by handler)
 * @property sessionStatus - Current session status string
 * @property sessionTitle - Session title
 * @property sessionType - Session type identifier
 * @property sessionTypeLabel - Human-readable type label
 * @property statusLabel - Human-readable status label
 * @property durationMinutes - Session duration in minutes
 * @property remainingMs - Timer remaining ms
 * @property energyLevel - Energy level (1-5) or 0
 * @property energyEditable - Whether energy dots are clickable
 * @property goals - Session goals array
 * @property tasks - Execution tasks array
 * @property notesText - Session notes text
 * @property activities - Activity entries array
 * @property activityFilter - Activity filter folders
 * @property contextBindings - Context binding objects
 * @property maxContextBindings - Max allowed bindings
 * @property decisions - Session decisions array
 * @property reflections - Session reflections array
 * @property outputArtifacts - Output artifacts array
 * @property guidingQuestions - Guiding questions for active session
 * @property intelligence - Activity intelligence stats
 * @property overloaded - Cognitive overload state
 * @property overloadReasons - Overload reason strings
 * @property focusFile - Optional focus file path
 * @property notesFile - Optional notes file path
 * @property canvasFile - Optional canvas file path
 * @property closureQuestions - Closure ritual questions (for reviewing status)
 * @property trainClosure - Optional train closure data
 * @property isEditable - Whether the session is in an editable state
 * @property showOutputs - Whether to show the outputs panel
 * @property isInSidebar - Whether shown in sidebar (affects action buttons)
 * @property canStart - Whether the Start button should be shown
 *
 * @fires action-pause - detail: { sessionId }
 * @fires action-resume - detail: { sessionId }
 * @fires action-complete - detail: { sessionId }
 * @fires action-start - detail: { sessionId }
 * @fires action-save-template
 * @fires action-sidebar
 * @fires action-tab
 * @fires file-open - detail: { path: string }
 * @fires canvas-create
 */
export class FlowtiSessionWorkspace extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sessionId: { type: String, attribute: 'session-id' },
		sessionStatus: { type: String, attribute: 'session-status' },
		sessionTitle: { type: String, attribute: 'session-title' },
		sessionType: { type: String, attribute: 'session-type' },
		sessionTypeLabel: { type: String, attribute: 'session-type-label' },
		statusLabel: { type: String, attribute: 'status-label' },
		durationMinutes: { type: Number, attribute: 'duration-minutes' },
		remainingMs: { type: Number, attribute: 'remaining-ms' },
		energyLevel: { type: Number, attribute: 'energy-level' },
		energyEditable: { type: Boolean, attribute: 'energy-editable' },
		goals: { type: Array },
		tasks: { type: Array },
		notesText: { type: String, attribute: 'notes-text' },
		activities: { type: Array },
		activityFilter: { type: Array, attribute: 'activity-filter' },
		contextBindings: { type: Array, attribute: 'context-bindings' },
		maxContextBindings: { type: Number, attribute: 'max-context-bindings' },
		decisions: { type: Array },
		reflections: { type: Array },
		outputArtifacts: { type: Array, attribute: 'output-artifacts' },
		guidingQuestions: { type: Array, attribute: 'guiding-questions' },
		intelligence: { type: Object },
		overloaded: { type: Boolean },
		overloadReasons: { type: Array, attribute: 'overload-reasons' },
		focusFile: { type: String, attribute: 'focus-file' },
		notesFile: { type: String, attribute: 'notes-file' },
		canvasFile: { type: String, attribute: 'canvas-file' },
		closureQuestions: { type: Array, attribute: 'closure-questions' },
		trainClosure: { type: Object, attribute: 'train-closure' },
		isEditable: { type: Boolean, attribute: 'is-editable' },
		showOutputs: { type: Boolean, attribute: 'show-outputs' },
		isInSidebar: { type: Boolean, attribute: 'is-in-sidebar' },
		canStart: { type: Boolean, attribute: 'can-start' },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		css`
			:host {
				display: block;
			}

			.workspace {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			/* Header */
			.header {
				padding: var(--flowti-space-md);
			}

			.title-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				flex-wrap: wrap;
			}

			.title-row h4 {
				margin: 0;
			}

			.badge {
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				font-weight: 500;
			}

			.type-badge {
				background: var(--background-secondary);
			}

			.status-badge-running {
				background: var(--color-green);
				color: var(--background-primary);
			}

			.status-badge-paused {
				background: var(--color-yellow);
				color: var(--background-primary);
			}

			.status-badge-reviewing {
				background: var(--color-orange, var(--color-yellow));
				color: var(--background-primary);
			}

			.status-badge-completed {
				background: var(--color-blue);
				color: var(--background-primary);
			}

			.status-badge-default {
				background: var(--background-modifier-hover);
			}

			/* Actions */
			.actions {
				display: flex;
				gap: var(--flowti-space-sm);
				flex-wrap: wrap;
				margin-top: var(--flowti-space-sm);
			}

			.action-btn {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
			}

			.action-btn:hover {
				background: var(--background-modifier-hover);
			}

			/* File links */
			.file-section {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
			}

			.file-label {
				color: var(--flowti-color-muted);
			}

			.file-link {
				color: var(--text-accent);
				cursor: pointer;
				text-decoration: none;
			}

			.file-link:hover {
				text-decoration: underline;
			}

			/* Guiding questions */
			.guiding {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.guiding-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				margin-bottom: var(--flowti-space-sm);
			}

			.guiding-list {
				margin: 0;
				padding-left: var(--flowti-space-lg);
			}

			.guiding-list li {
				margin-bottom: var(--flowti-space-xs);
			}

			/* Intelligence stats */
			.intelligence {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.intelligence-stats {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm);
			}

			.stat {
				display: flex;
				flex-direction: column;
				align-items: center;
			}

			.stat-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.stat-value {
				font-weight: 600;
			}

			/* Empty state */
			.empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl);
				color: var(--flowti-color-muted);
				text-align: center;
				gap: var(--flowti-space-sm);
			}

			.empty-icon {
				font-size: 2em;
				opacity: 0.5;
			}

			/* Train closure */
			.train-closure {
				padding: var(--flowti-space-md);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				margin: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.train-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.train-stats {
				display: flex;
				gap: var(--flowti-space-md);
				font-size: var(--flowti-font-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.train-thoughts {
				font-size: var(--flowti-font-sm);
			}

			.train-thoughts div {
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-xs);
			}
		`,
	];

	sessionId = '';
	sessionStatus = '';
	sessionTitle = '';
	sessionType = '';
	sessionTypeLabel = '';
	statusLabel = '';
	durationMinutes = 0;
	remainingMs = 0;
	energyLevel = 0;
	energyEditable = false;
	goals: Array<{ id: string; text: string; completed: boolean }> = [];
	tasks: Array<{ id: string; label: string; completed: boolean; order: number }> = [];
	notesText = '';
	activities: Array<{ path: string; action: string; timestamp: string }> = [];
	activityFilter: string[] = [];
	contextBindings: Array<{ id: string; type: string; label: string; path: string }> = [];
	maxContextBindings = 10;
	decisions: Array<{ id: string; title: string; description?: string; context?: string }> = [];
	reflections: Array<{ id: string; type: string; content: string }> = [];
	outputArtifacts: Array<{ type: string; path: string; generatedAt: string }> = [];
	guidingQuestions: string[] = [];
	intelligence: IntelligenceStats | null = null;
	overloaded = false;
	overloadReasons: string[] = [];
	focusFile = '';
	notesFile = '';
	canvasFile = '';
	closureQuestions: Array<{ id: string; question: string; type: string; required: boolean; options?: string[] }> = [];
	trainClosure: TrainClosureData | null = null;
	isEditable = true;
	showOutputs = false;
	isInSidebar = false;
	canStart = false;

	private dispatch(name: string, detail?: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, {
			detail: detail ?? {},
			bubbles: true,
			composed: true,
		}));
	}

	private getStatusBadgeClass(): string {
		switch (this.sessionStatus) {
			case 'active':
			case 'running': return 'status-badge-running';
			case 'paused': return 'status-badge-paused';
			case 'reviewing': return 'status-badge-reviewing';
			case 'completed': return 'status-badge-completed';
			default: return 'status-badge-default';
		}
	}

	protected renderContent() {
		if (!this.sessionId) {
			return html`
				<div class="empty-state">
					<div class="empty-icon">\u23F1\uFE0F</div>
					<p>No session selected</p>
					<p style="font-size: var(--flowti-font-sm)">Open a session from the User hub \u2192 sessions tab.</p>
				</div>
			`;
		}

		if (this.sessionStatus === 'reviewing') {
			return html`
				<div class="workspace">
					${this.renderHeader()}
					${this.renderClosureOverlay()}
				</div>
			`;
		}

		return html`
			<div class="workspace">
				${this.renderHeader()}
				${this.durationMinutes > 0 ? html`
					<flowti-session-timer
						remaining-ms=${this.remainingMs}
						duration-minutes=${this.durationMinutes}
						session-status=${this.sessionStatus}
					></flowti-session-timer>
				` : nothing}

				<flowti-session-energy
					energy-level=${this.energyLevel}
					?editable=${this.energyEditable}
				></flowti-session-energy>

				${this.renderIntelligence()}
				${this.renderGuidingQuestions()}

				<flowti-session-goals
					.goals=${this.goals}
					?editable=${this.isEditable}
				></flowti-session-goals>

				<flowti-session-tasks
					.tasks=${this.tasks}
					?editable=${this.isEditable}
				></flowti-session-tasks>

				<flowti-session-overload
					?overloaded=${this.overloaded}
					.reasons=${this.overloadReasons}
				></flowti-session-overload>

				<flowti-session-notes
					.notes=${this.notesText}
				></flowti-session-notes>

				${this.renderFileLinks()}

				<flowti-session-context
					.bindings=${this.contextBindings}
					max-bindings=${this.maxContextBindings}
				></flowti-session-context>

				<flowti-session-decisions
					.decisions=${this.decisions}
					?editable=${this.isEditable}
				></flowti-session-decisions>

				<flowti-session-reflections
					.reflections=${this.reflections}
					?editable=${this.isEditable}
				></flowti-session-reflections>

				<flowti-session-activity
					.activities=${this.activities}
					.activityFilter=${this.activityFilter}
				></flowti-session-activity>

				${this.showOutputs ? html`
					<flowti-session-outputs
						.artifacts=${this.outputArtifacts}
					></flowti-session-outputs>
				` : nothing}
			</div>
		`;
	}

	private renderHeader() {
		return html`
			<div class="header">
				<div class="title-row">
					<h4>${this.sessionTitle}</h4>
					<span class="badge type-badge">${this.sessionTypeLabel}</span>
					<span class="badge ${this.getStatusBadgeClass()}">${this.statusLabel}</span>
				</div>
				<div class="actions">
					${this.renderActionButtons()}
				</div>
			</div>
		`;
	}

	private renderActionButtons() {
		const status = this.sessionStatus;
		const buttons = [];

		if (status === 'active' || status === 'running') {
			buttons.push(html`
				<button class="action-btn" @click=${() => this.dispatch('action-pause', { sessionId: this.sessionId })}>Pause</button>
				<button class="action-btn" @click=${() => this.dispatch('action-complete', { sessionId: this.sessionId })}>Complete</button>
			`);
		} else if (status === 'paused') {
			buttons.push(html`
				<button class="action-btn" @click=${() => this.dispatch('action-resume', { sessionId: this.sessionId })}>Resume</button>
				<button class="action-btn" @click=${() => this.dispatch('action-complete', { sessionId: this.sessionId })}>Complete</button>
			`);
		} else if (status === 'prepared' && this.canStart) {
			buttons.push(html`
				<button class="action-btn" @click=${() => this.dispatch('action-start', { sessionId: this.sessionId })}>Start</button>
			`);
		}

		buttons.push(html`
			<button class="action-btn" @click=${() => this.dispatch('action-save-template')}>Save as Template</button>
		`);

		if (this.isInSidebar) {
			buttons.push(html`
				<button class="action-btn" @click=${() => this.dispatch('action-tab')}>Open in Tab</button>
			`);
		} else {
			buttons.push(html`
				<button class="action-btn" @click=${() => this.dispatch('action-sidebar')}>Sidebar</button>
			`);
		}

		return buttons;
	}

	private renderGuidingQuestions() {
		if (this.guidingQuestions.length === 0) return nothing;

		return html`
			<div class="guiding">
				<div class="guiding-header">
					<span>\u2753</span>
					<strong>Guiding questions</strong>
				</div>
				<ul class="guiding-list">
					${this.guidingQuestions.map((q) => html`<li>${q}</li>`)}
				</ul>
			</div>
		`;
	}

	private renderIntelligence() {
		const intel = this.intelligence;
		if (!intel) return nothing;
		if (intel.filesModified === 0 && intel.artifactsProduced === 0 &&
			intel.tasksCompleted === 0 && intel.eventsEmitted === 0 && intel.activeTimeMs === 0) {
			return nothing;
		}

		const items: Array<{ label: string; value: string }> = [
			{ label: 'Files', value: String(intel.filesModified) },
			{ label: 'Artifacts', value: String(intel.artifactsProduced) },
			{ label: 'Tasks', value: String(intel.tasksCompleted) },
			{ label: 'Events', value: String(intel.eventsEmitted) },
			{ label: 'Active', value: this.formatDurationHuman(intel.activeTimeMs) },
		];

		if (intel.pauseTimeMs > 0) {
			items.push({ label: 'Paused', value: this.formatDurationHuman(intel.pauseTimeMs) });
		}

		return html`
			<div class="intelligence">
				<strong>Activity</strong>
				<div class="intelligence-stats">
					${items.map((item) => html`
						<span class="stat">
							<span class="stat-label">${item.label}</span>
							<span class="stat-value">${item.value}</span>
						</span>
					`)}
				</div>
			</div>
		`;
	}

	private renderFileLinks() {
		return html`
			${this.focusFile && this.focusFile !== this.notesFile ? html`
				<div class="file-section">
					<span class="file-label">Focus:</span>
					<a class="file-link" @click=${() => this.dispatch('file-open', { path: this.focusFile })}>${this.focusFile}</a>
				</div>
			` : nothing}
			${this.notesFile ? html`
				<div class="file-section">
					<span class="file-label">Session note:</span>
					<a class="file-link" title=${this.notesFile} @click=${() => this.dispatch('file-open', { path: this.notesFile })}>${this.notesFile.split('/').pop() ?? this.notesFile}</a>
				</div>
			` : nothing}
			${this.canvasFile ? html`
				<div class="file-section">
					<span class="file-label">Session canvas:</span>
					<a class="file-link" title=${this.canvasFile} @click=${() => this.dispatch('file-open', { path: this.canvasFile })}>${this.canvasFile.split('/').pop() ?? this.canvasFile}</a>
				</div>
			` : html`
				<div class="file-section">
					<button class="action-btn" @click=${() => this.dispatch('canvas-create')}>Create session canvas</button>
				</div>
			`}
		`;
	}

	private renderClosureOverlay() {
		return html`
			${this.trainClosure ? this.renderTrainClosure() : nothing}
			<flowti-session-closure
				session-title=${this.sessionTitle}
				.questions=${this.closureQuestions}
			></flowti-session-closure>
		`;
	}

	private renderTrainClosure() {
		const t = this.trainClosure!;
		return html`
			<div class="train-closure">
				<div class="train-header">
					${t.trainType ? html`<span class="badge type-badge">${t.trainType}</span>` : nothing}
					<span>${t.title}</span>
				</div>
				<div class="train-stats">
					<span>${t.thoughtCount} thoughts</span>
					<span>${t.branchCount} ${t.branchCount === 1 ? 'branch' : 'branches'}</span>
					${t.mergeCount > 0 ? html`<span>${t.mergeCount} ${t.mergeCount === 1 ? 'merge' : 'merges'}</span>` : nothing}
					<span>${t.elapsed} elapsed</span>
				</div>
				${t.keyThoughts.length > 0 ? html`
					<div class="train-thoughts">
						<div>Key thoughts:</div>
						${t.keyThoughts.map((title) => html`<div>\u2022 ${title}</div>`)}
					</div>
				` : nothing}
			</div>
		`;
	}

	private formatDurationHuman(ms: number): string {
		if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
		if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
		const h = Math.floor(ms / 3_600_000);
		const m = Math.round((ms % 3_600_000) / 60_000);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
}

if (!customElements.get('flowti-session-workspace')) customElements.define('flowti-session-workspace', FlowtiSessionWorkspace);
