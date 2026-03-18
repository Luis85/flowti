import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import './flowti-journey-toolbar.js';
import './flowti-journey-sidebar.js';
import './flowti-journey-step.js';

/**
 * Main journey builder orchestrator. Manages a 3-state machine:
 * welcome, setup, and steps. Composes toolbar, sidebar, and step editor.
 * All mutations dispatched as CustomEvents for the leaf handler.
 *
 * Events bubble up from child components (toolbar, sidebar, step).
 * Direct events: create-new, open-existing, import-from-system,
 * continue-to-steps, metadata-changed, toolbar-back.
 */
type BuilderState = 'welcome' | 'setup' | 'steps';

interface StepData {
	id: string;
	title: string;
	description: string;
	swimlane: string;
	actions: unknown[];
	events?: string[];
	commands?: string[];
	interactions?: string[];
	components?: string[];
	backgroundImage?: string;
}

export class FlowtiJourneyBuilder extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		state: { type: String },
		journeyName: { type: String, attribute: 'journey-name' },
		journeyDescription: { type: String, attribute: 'journey-description' },
		startEvent: { type: String, attribute: 'start-event' },
		endEvent: { type: String, attribute: 'end-event' },
		steps: { type: Array },
		currentStepIndex: { type: Number, attribute: 'current-step-index' },
		canvasSyncing: { type: Boolean, attribute: 'canvas-syncing' },
		hasExistingJourneys: { type: Boolean, attribute: 'has-existing-journeys' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: flex; flex-direction: column; height: 100%; }
			.builder { display: flex; flex-direction: column; height: 100%; gap: var(--flowti-space-sm); }
			.builder-body { display: flex; flex: 1; gap: var(--flowti-space-md); overflow: hidden; }
			.builder-sidebar { flex: 0 0 240px; overflow-y: auto; }
			.builder-main { flex: 1; overflow-y: auto; }
			.welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--flowti-space-xl); gap: var(--flowti-space-lg); flex: 1; }
			.welcome-title { font-size: 1.3em; font-weight: 700; }
			.welcome-desc { color: var(--flowti-color-muted); font-size: var(--flowti-font-sm); text-align: center; }
			.welcome-cards { display: flex; gap: var(--flowti-space-md); flex-wrap: wrap; justify-content: center; }
			.welcome-card { display: flex; flex-direction: column; align-items: center; gap: var(--flowti-space-sm); padding: var(--flowti-space-lg); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); cursor: pointer; width: 180px; text-align: center; }
			.welcome-card:hover { background: var(--background-modifier-hover); }
			.welcome-card__icon { font-size: 2em; opacity: 0.6; }
			.welcome-card__title { font-weight: 600; }
			.welcome-card__desc { font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.welcome-links { display: flex; gap: var(--flowti-space-md); }
			.welcome-link { cursor: pointer; color: var(--flowti-color-info); font-size: var(--flowti-font-sm); text-decoration: underline; }
			.welcome-link:hover { opacity: 0.8; }
			.setup { display: flex; flex-direction: column; gap: var(--flowti-space-md); padding: var(--flowti-space-md); max-width: 480px; margin: 0 auto; }
			.setup-title { font-size: 1.1em; font-weight: 600; }
			.form-group { display: flex; flex-direction: column; gap: 4px; }
			.form-label { font-size: var(--flowti-font-sm); font-weight: 500; }
			.form-input, .form-textarea { padding: var(--flowti-space-xs) var(--flowti-space-sm); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); background: var(--background-primary); color: var(--text-normal); font-family: inherit; }
			.form-textarea { resize: vertical; }
			.setup-actions { display: flex; gap: var(--flowti-space-sm); justify-content: flex-end; }
			button { padding: var(--flowti-space-xs) var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-secondary); color: var(--text-normal); font-size: var(--flowti-font-sm); cursor: pointer; }
			button:hover { background: var(--background-modifier-hover); }
			.btn-primary { background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent); border-color: var(--flowti-color-info); }
			.step-editor-empty { display: flex; align-items: center; justify-content: center; padding: var(--flowti-space-xl); color: var(--flowti-color-muted); font-size: var(--flowti-font-sm); }
		`,
	];

	state: BuilderState = 'welcome';
	journeyName = '';
	journeyDescription = '';
	startEvent = '';
	endEvent = '';
	steps: StepData[] = [];
	currentStepIndex = 0;
	canvasSyncing = false;
	hasExistingJourneys = false;

	private dispatch(name: string, detail?: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail: detail ?? {}, bubbles: true, composed: true }));
	}

	protected renderContent() {
		switch (this.state) {
			case 'setup': return this.renderSetup();
			case 'steps': return this.renderSteps();
			default: return this.renderWelcome();
		}
	}

	private renderWelcome() {
		return html`
			<div class="welcome">
				<div class="welcome-title">Journey builder</div>
				<div class="welcome-desc">Create, edit, and run E2E journey definitions visually.</div>
				<div class="welcome-cards">
					${this.hasExistingJourneys ? html`
						<div class="welcome-card" role="button" tabindex="0"
							@click=${() => this.dispatch('open-existing')}
							@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.dispatch('open-existing'); } }}>
							<div class="welcome-card__icon">&#x1F50D;</div>
							<div class="welcome-card__title">Open journey</div>
							<div class="welcome-card__desc">Open a journey or canvas from your vault</div>
						</div>
					` : nothing}
					<div class="welcome-card" role="button" tabindex="0"
						@click=${() => this.dispatch('create-new')}
						@keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.dispatch('create-new'); } }}>
						<div class="welcome-card__icon">&#x2795;</div>
						<div class="welcome-card__title">Create new journey</div>
						<div class="welcome-card__desc">Design a new E2E journey from scratch</div>
					</div>
				</div>
				<div class="welcome-links">
					${!this.hasExistingJourneys ? html`
						<span class="welcome-link" role="button" tabindex="0"
							@click=${() => this.dispatch('open-existing')}>Open from vault</span>
					` : nothing}
					<span class="welcome-link" role="button" tabindex="0"
						@click=${() => this.dispatch('import-from-system')}>Browse from file system</span>
				</div>
			</div>
		`;
	}

	private renderSetup() {
		return html`
			<div class="setup">
				<div class="setup-title">Journey setup</div>
				<div class="form-group">
					<label class="form-label">Name</label>
					<input class="form-input" type="text" placeholder="Journey name..."
						.value=${this.journeyName}
						@input=${(e: InputEvent) => this.dispatch('metadata-changed', { field: 'name', value: (e.target as HTMLInputElement).value })} />
				</div>
				<div class="form-group">
					<label class="form-label">Description</label>
					<textarea class="form-textarea" rows="3" placeholder="Journey description..."
						.value=${this.journeyDescription}
						@input=${(e: InputEvent) => this.dispatch('metadata-changed', { field: 'description', value: (e.target as HTMLTextAreaElement).value })}></textarea>
				</div>
				<div class="form-group">
					<label class="form-label">Start event</label>
					<input class="form-input" type="text" placeholder="e.g. user.signed-up"
						.value=${this.startEvent}
						@input=${(e: InputEvent) => this.dispatch('metadata-changed', { field: 'startEvent', value: (e.target as HTMLInputElement).value })} />
				</div>
				<div class="form-group">
					<label class="form-label">End event</label>
					<input class="form-input" type="text" placeholder="e.g. user.completed-onboarding"
						.value=${this.endEvent}
						@input=${(e: InputEvent) => this.dispatch('metadata-changed', { field: 'endEvent', value: (e.target as HTMLInputElement).value })} />
				</div>
				<div class="setup-actions">
					<button @click=${() => this.dispatch('toolbar-back')}>Back</button>
					<button class="btn-primary" @click=${() => this.dispatch('continue-to-steps')}>Continue to steps</button>
				</div>
			</div>
		`;
	}

	private renderSteps() {
		const currentStep = this.steps[this.currentStepIndex] ?? null;
		return html`
			<div class="builder">
				<flowti-journey-toolbar
					journey-name=${this.journeyName}
					step-count=${this.steps.length}
					?canvas-syncing=${this.canvasSyncing}
				></flowti-journey-toolbar>
				<div class="builder-body">
					<div class="builder-sidebar">
						<flowti-journey-sidebar .steps=${this.steps} current-index=${this.currentStepIndex}></flowti-journey-sidebar>
					</div>
					<div class="builder-main">
						${currentStep ? html`
							<flowti-journey-step .step=${currentStep} step-number=${this.currentStepIndex + 1} action-count=${currentStep.actions.length}></flowti-journey-step>
						` : html`<div class="step-editor-empty">No steps yet. Click "Add step" to begin.</div>`}
					</div>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-journey-builder')) customElements.define('flowti-journey-builder', FlowtiJourneyBuilder);
