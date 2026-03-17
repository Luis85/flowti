/**
 * Onboarding domain service — manages post-install guidance state.
 *
 * Owns the Getting Started checklist (migrated from AnalyticsService),
 * first-visit callout tracking, and onboarding lifecycle persistence.
 *
 * Storage key: "onboarding"
 *
 * @see Onboarding PRD — Phase 2, PBI-ONB-012
 */

import type { ITypedStorage } from "../../utils/TypedStorage";
import type { IEventBus } from "../../infrastructure/events/types";
import type { OnboardingChecklist, OnboardingMilestones, OnboardingState } from "./types";

export interface OnboardingServiceOptions {
	storage: ITypedStorage<OnboardingState>;
	eventBus?: IEventBus;
	/** Callback to read legacy checklist from AnalyticsState (for migration). */
	readLegacyChecklist?: () => OnboardingChecklist | undefined;
}

function createDefaultChecklist(): OnboardingChecklist {
	return {
		dismissed: false,
		collapsed: false,
		milestones: {
			installed: true,
			dashboardExplored: false,
			sampleDataReviewed: false,
			ownDataImported: false,
			customQueryBuilt: false,
			catalogExplored: false,
			startpageConfigured: false,
		},
	};
}

export class OnboardingService {
	private storage: ITypedStorage<OnboardingState>;
	private eventBus?: IEventBus;
	private readLegacyChecklist?: () => OnboardingChecklist | undefined;
	private state: OnboardingState | undefined;

	constructor(options: OnboardingServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.readLegacyChecklist = options.readLegacyChecklist;
	}

	// ── Lifecycle ────────────────────────────────────────────

	/** Load persisted state, migrating from AnalyticsState if needed. */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
			return;
		}

		// Migration: check for legacy checklist in AnalyticsState
		const legacy = this.readLegacyChecklist?.();
		if (legacy) {
			this.state = {
				checklist: legacy,
				dismissedCallouts: [],
				firstVisits: {},
				startedAt: new Date().toISOString(),
			};
			await this.storage.save(this.state);
			return;
		}

		// No state at all — service is uninitialised (will be initialised after install)
	}

	/** Get the full onboarding state, or undefined if not yet initialised. */
	getState(): OnboardingState | undefined {
		return this.state;
	}

	// ── Checklist ────────────────────────────────────────────

	/** Get the onboarding checklist, or undefined if not yet initialised. */
	getChecklist(): OnboardingChecklist | undefined {
		return this.state?.checklist;
	}

	/** Initialise the onboarding checklist (called after install). */
	async initChecklist(): Promise<void> {
		if (this.state) return; // already initialised
		const startedAt = new Date().toISOString();
		this.state = {
			checklist: createDefaultChecklist(),
			dismissedCallouts: [],
			firstVisits: {},
			startedAt,
		};
		await this.storage.save(this.state);
		void this.eventBus?.emit("onboarding.started", { startedAt });
	}

	/** Update onboarding checklist (partial merge). */
	async updateChecklist(update: Partial<OnboardingChecklist>): Promise<void> {
		if (!this.state) return;

		// Snapshot milestone state before merge to detect new completions
		const prevMilestones = { ...this.state.checklist.milestones };

		if (update.milestones) {
			Object.assign(this.state.checklist.milestones, update.milestones);
		}
		if (update.dismissed !== undefined) this.state.checklist.dismissed = update.dismissed;
		if (update.collapsed !== undefined) this.state.checklist.collapsed = update.collapsed;
		await this.storage.save(this.state);

		// Emit step.completed for each newly-completed milestone
		if (update.milestones) {
			const ms = this.state.checklist.milestones;
			for (const [key, value] of Object.entries(ms)) {
				if (value && !prevMilestones[key as keyof OnboardingMilestones]) {
					void this.eventBus?.emit("onboarding.step.completed", {
						milestone: key,
						completedCount: this.getCompletedMilestoneCount(),
						totalCount: this.getTotalMilestoneCount(),
					});
				}
			}

			// Check if all milestones are now complete
			if (this.isComplete() && !this.state.completedAt) {
				const completedAt = new Date().toISOString();
				this.state.completedAt = completedAt;
				await this.storage.save(this.state);
				const durationMs = new Date(completedAt).getTime() - new Date(this.state.startedAt).getTime();
				void this.eventBus?.emit("onboarding.completed", { completedAt, durationMs });
			}
		}
	}

	/** Dismiss the onboarding checklist permanently. */
	async dismissChecklist(): Promise<void> {
		if (!this.state) return;
		this.state.checklist.dismissed = true;
		await this.storage.save(this.state);
	}

	// ── First-visit tracking ─────────────────────────────────

	/** Check if a view has been visited before. */
	hasVisited(viewType: string): boolean {
		return !!this.state?.firstVisits[viewType];
	}

	/** Record that a view was visited for the first time. */
	async recordFirstVisit(viewType: string): Promise<void> {
		if (!this.state || this.state.firstVisits[viewType]) return;
		this.state.firstVisits[viewType] = new Date().toISOString();
		await this.storage.save(this.state);
	}

	// ── Callout tracking ─────────────────────────────────────

	/** Check if a callout has been dismissed. */
	isCalloutDismissed(calloutId: string): boolean {
		return !!this.state?.dismissedCallouts.includes(calloutId);
	}

	/** Mark a callout as dismissed. */
	async markCalloutDismissed(calloutId: string): Promise<void> {
		if (!this.state) return;
		if (this.state.dismissedCallouts.includes(calloutId)) return;
		this.state.dismissedCallouts.push(calloutId);
		await this.storage.save(this.state);
	}

	// ── Reset ────────────────────────────────────────────────

	/** Reset all onboarding state (called from Settings). */
	async resetAll(): Promise<void> {
		this.state = {
			checklist: createDefaultChecklist(),
			dismissedCallouts: [],
			firstVisits: {},
			startedAt: new Date().toISOString(),
		};
		await this.storage.save(this.state);
		void this.eventBus?.emit("onboarding.reset", {});
	}

	// ── Milestones helper ────────────────────────────────────

	/** Get the count of completed milestones. */
	getCompletedMilestoneCount(): number {
		if (!this.state) return 0;
		return Object.values(this.state.checklist.milestones).filter(Boolean).length;
	}

	/** Get the total number of milestones. */
	getTotalMilestoneCount(): number {
		return 7;
	}

	/** Check if all milestones are completed. */
	isComplete(): boolean {
		if (!this.state) return false;
		const ms = this.state.checklist.milestones;
		return ms.installed && ms.dashboardExplored && ms.sampleDataReviewed
			&& ms.ownDataImported && ms.customQueryBuilt
			&& !!ms.catalogExplored && !!ms.startpageConfigured;
	}

	/** Get the milestones object, or undefined if not initialised. */
	getMilestones(): OnboardingMilestones | undefined {
		return this.state?.checklist.milestones;
	}
}
