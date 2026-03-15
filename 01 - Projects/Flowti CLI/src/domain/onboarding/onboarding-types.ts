import type { CliDeps } from "../../infrastructure/deps.js";

// --- Deps ---

export type OnboardingStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;
export type OnboardingDetectionDeps = Pick<CliDeps, "disk" | "paths">;

// --- Validation ---

export type PromptValidation = "non-empty" | "slug";

// --- Tour Definition (loaded from tour.json) ---

export type StepType = "narrate" | "prompt" | "delegate" | "auto" | "checkpoint";

export interface TourStepBase {
	readonly id: string;
	readonly type: StepType;
	readonly content: string;
}

export interface NarrateStep extends TourStepBase {
	readonly type: "narrate";
}

export interface PromptStep extends TourStepBase {
	readonly type: "prompt";
	readonly field: string;
	readonly validation?: PromptValidation;
}

export interface DelegateStep extends TourStepBase {
	readonly type: "delegate";
	readonly target: string;
	readonly hints?: string;
}

export interface AutoStep extends TourStepBase {
	readonly type: "auto";
	readonly action: string;
}

export interface CheckpointStep extends TourStepBase {
	readonly type: "checkpoint";
	readonly label: string;
}

export type TourStep = NarrateStep | PromptStep | DelegateStep | AutoStep | CheckpointStep;

export interface Tour {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly description: string;
	readonly steps: readonly TourStep[];
}

export interface TourRegistryEntry {
	readonly id: string;
	readonly path: string;
}

export interface TourRegistry {
	readonly tours: readonly TourRegistryEntry[];
}

// --- Tour Progress (persisted) ---

export interface TourProgress {
	readonly tourId: string;
	readonly currentStepIndex: number;
	readonly completedSteps: readonly string[];
	readonly context: Readonly<Record<string, string>>;
	readonly startedAt: string;
}

// --- Step Results (returned by tour engine) ---

export interface NarrateResult {
	readonly kind: "narrate";
	readonly content: string;
	readonly speaker: string;
	readonly disposition: string;
}

export interface PromptResult {
	readonly kind: "prompt";
	readonly content: string;
	readonly field: string;
	readonly validation?: PromptValidation;
}

export interface DelegateResult {
	readonly kind: "delegate";
	readonly target: string;
	readonly tourId: string;
	readonly stepId: string;
	readonly hintsContent?: string;
}

export interface AutoResult {
	readonly kind: "auto";
	readonly action: string;
	readonly content: string;
	readonly context: Readonly<Record<string, string>>;
}

export interface CheckpointResult {
	readonly kind: "checkpoint";
	readonly label: string;
	readonly content: string;
	readonly completedSteps: readonly string[];
}

export interface TourCompleteResult {
	readonly kind: "complete";
	readonly completedSteps: readonly string[];
}

export type StepResult =
	| NarrateResult
	| PromptResult
	| DelegateResult
	| AutoResult
	| CheckpointResult
	| TourCompleteResult;

// --- Content Frontmatter ---

export interface StepFrontmatter {
	readonly speaker?: string;
	readonly disposition?: string;
}

// --- Onboarding State ---

export interface OnboardingStatus {
	readonly isComplete: boolean;
	readonly activeTour?: TourProgress;
}
