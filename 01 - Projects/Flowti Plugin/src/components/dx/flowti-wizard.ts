import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

export interface WizardStep {
	id: string;
	label: string;
}

/**
 * Generic multi-step wizard component with step indicator, navigation,
 * and content slot. Manages current step state.
 *
 * @property steps - Array of step definitions
 * @property currentStep - ID of the currently active step
 * @property canGoNext - Whether the next button is enabled
 * @property canGoPrev - Whether the previous button is enabled
 * @property nextLabel - Label for the next button (default: "Next")
 * @property showNav - Whether to show the navigation buttons (default: true)
 *
 * @fires step-change - detail: { stepId, stepIndex, direction } when step changes
 * @fires wizard-complete - When the final step's next button is clicked
 * @fires wizard-cancel - When cancel/back on first step is clicked
 */
export class FlowtiWizard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		steps: { type: Array },
		currentStep: { type: String, attribute: 'current-step' },
		canGoNext: { type: Boolean, attribute: 'can-go-next' },
		canGoPrev: { type: Boolean, attribute: 'can-go-prev' },
		nextLabel: { type: String, attribute: 'next-label' },
		showNav: { type: Boolean, attribute: 'show-nav' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			.wizard-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-bottom: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}

			.step-indicator {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				flex: 1;
			}

			.step {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				cursor: pointer;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
			}

			.step:hover {
				background: var(--background-modifier-hover);
			}

			.step--active {
				color: var(--flowti-text, inherit);
				font-weight: 600;
			}

			.step--completed {
				color: var(--flowti-color-success);
			}

			.step-number {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5em;
				height: 1.5em;
				border-radius: 50%;
				border: 1px solid currentColor;
				font-size: 0.75em;
			}

			.step--active .step-number {
				background: var(--flowti-color-info);
				color: white;
				border-color: var(--flowti-color-info);
			}

			.step--completed .step-number {
				background: var(--flowti-color-success);
				color: white;
				border-color: var(--flowti-color-success);
			}

			.step-separator {
				width: 20px;
				height: 1px;
				background: var(--flowti-border);
			}

			.wizard-content {
				flex: 1;
				overflow-y: auto;
				min-height: 0;
			}

			.wizard-nav {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-top: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}

			.nav-spacer {
				flex: 1;
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover:not(:disabled) {
				background: var(--background-modifier-hover);
			}

			button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.btn-primary {
				background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
				border-color: var(--flowti-color-info);
				color: var(--flowti-color-info);
			}

			.btn-ghost {
				background: none;
				border-color: transparent;
			}
		`,
	];

	steps: WizardStep[] = [];
	currentStep = '';
	canGoNext = true;
	canGoPrev = true;
	nextLabel = 'Next';
	showNav = true;

	private get currentIndex(): number {
		return this.steps.findIndex((s) => s.id === this.currentStep);
	}

	private get isFirstStep(): boolean {
		return this.currentIndex <= 0;
	}

	private get isLastStep(): boolean {
		return this.currentIndex >= this.steps.length - 1;
	}

	private goToStep(stepId: string, direction: 'forward' | 'backward' | 'jump'): void {
		const stepIndex = this.steps.findIndex((s) => s.id === stepId);
		if (stepIndex < 0) return;
		this.currentStep = stepId;
		this.dispatchEvent(
			new CustomEvent('step-change', {
				detail: { stepId, stepIndex, direction },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onPrev(): void {
		if (this.isFirstStep) {
			this.dispatchEvent(
				new CustomEvent('wizard-cancel', { bubbles: true, composed: true }),
			);
			return;
		}
		const prevStep = this.steps[this.currentIndex - 1];
		this.goToStep(prevStep.id, 'backward');
	}

	private onNext(): void {
		if (this.isLastStep) {
			this.dispatchEvent(
				new CustomEvent('wizard-complete', { bubbles: true, composed: true }),
			);
			return;
		}
		const nextStep = this.steps[this.currentIndex + 1];
		this.goToStep(nextStep.id, 'forward');
	}

	protected renderContent() {
		return html`
			${this.renderStepIndicator()}
			<div class="wizard-content">
				<slot></slot>
			</div>
			${this.showNav ? this.renderNavigation() : nothing}
		`;
	}

	private renderStepIndicator() {
		const currentIdx = this.currentIndex;
		return html`
			<div class="wizard-header">
				<div class="step-indicator">
					${this.steps.map((step, i) => html`
						${i > 0 ? html`<div class="step-separator"></div>` : nothing}
						<div
							class="step ${i === currentIdx ? 'step--active' : ''} ${i < currentIdx ? 'step--completed' : ''}"
							@click=${() => this.goToStep(step.id, i < currentIdx ? 'backward' : 'forward')}
						>
							<span class="step-number">${i < currentIdx ? '\u2713' : i + 1}</span>
							<span>${step.label}</span>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	private renderNavigation() {
		return html`
			<div class="wizard-nav">
				<button
					class="btn-ghost"
					?disabled=${!this.canGoPrev && !this.isFirstStep}
					@click=${this.onPrev}
				>
					${this.isFirstStep ? 'Cancel' : 'Back'}
				</button>
				<div class="nav-spacer"></div>
				<button
					class="btn-primary"
					?disabled=${!this.canGoNext}
					@click=${this.onNext}
				>
					${this.isLastStep ? 'Finish' : this.nextLabel}
				</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-wizard')) customElements.define('flowti-wizard', FlowtiWizard);
