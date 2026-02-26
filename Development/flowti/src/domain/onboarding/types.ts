/**
 * Type definitions for the Onboarding domain.
 *
 * Onboarding manages post-install guidance: Getting Started checklist,
 * first-visit callout tracking, and onboarding lifecycle state.
 *
 * @see Onboarding PRD — Phase 2
 */

// ── Checklist types (migrated from analytics/types.ts) ───

/** Milestone tracking for the post-install onboarding checklist. */
export interface OnboardingMilestones {
	installed: boolean;
	dashboardExplored: boolean;
	sampleDataReviewed: boolean;
	ownDataImported: boolean;
	customQueryBuilt: boolean;
}

/** Persisted onboarding checklist state. */
export interface OnboardingChecklist {
	dismissed: boolean;
	collapsed: boolean;
	milestones: OnboardingMilestones;
}

// ── Onboarding state ────────────────────────────────────

/** Persisted state for the Onboarding domain (TypedStorage key: "onboarding"). */
export interface OnboardingState {
	/** Getting Started checklist (migrated from AnalyticsState) */
	checklist: OnboardingChecklist;
	/** IDs of callouts the user has dismissed */
	dismissedCallouts: string[];
	/** Map of viewType → ISO timestamp of first visit */
	firstVisits: Record<string, string>;
	/** ISO timestamp when onboarding was first initialised */
	startedAt: string;
	/** ISO timestamp when all milestones completed (undefined if not yet) */
	completedAt?: string;
}
