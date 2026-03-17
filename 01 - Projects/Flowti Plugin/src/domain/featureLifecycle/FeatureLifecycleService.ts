/**
 * Feature Lifecycle domain service.
 *
 * Scans PRD files from the vault, normalizes stages, computes FRI scores,
 * and manages the feature pipeline. Acts as the orchestrator for all
 * feature lifecycle operations.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	FeatureEntry,
	FeatureLifecycleState,
	FeatureSessionRecord,
	FeatureStage,
	FRIResult,
	FRIScores,
	GateCheckResult,
	GateName,
	PrioritizationResult,
	PrioritizationScores,
} from "./types";
import {
	FEATURE_STAGES,
	LEGACY_STAGE_MAP,
	STAGE_GATE_MAP,
	FRI_DIMENSIONS,
	FRI_LEVEL_THRESHOLDS,
	PRIORITIZATION_DIMENSIONS,
} from "./types";
import { PRDFrontmatterSchema, type PRDFrontmatter } from "./schemas";
import { runGateCheck, type GateContext } from "./gateChecks";
import { computeFeatureSessionMetrics, createSessionRecordFromEvent, type FeatureSessionMetrics } from "./sessionMetrics";

/** A discovered PRD file with parsed frontmatter. */
export interface ScannedPRD {
	/** File path relative to vault root */
	path: string;
	/** File basename (without extension) */
	name: string;
	/** Parsed frontmatter key-value pairs */
	frontmatter: Record<string, unknown>;
}

/** Result of a stage advancement attempt. */
export interface AdvanceStageResult {
	success: boolean;
	gateResult: GateCheckResult | null;
	error?: string;
}

/** Configuration options for FeatureLifecycleService. */
export interface FeatureLifecycleServiceOptions {
	storage: ITypedStorage<FeatureLifecycleState>;
	eventBus: IEventBus;
	/** Callback that scans the vault for PRD files. Injected from main.ts. */
	scanPRDs?: () => Promise<ScannedPRD[]>;
	/** Callback to update a frontmatter field in a vault file. Injected from main.ts. */
	updateFrontmatter?: (path: string, key: string, value: string) => Promise<void>;
}

export class FeatureLifecycleService {
	private state: FeatureLifecycleState = { sessions: [], activeSession: null };
	private features: FeatureEntry[] = [];
	private storage: ITypedStorage<FeatureLifecycleState>;
	private eventBus: IEventBus;
	private scanPRDsFn?: () => Promise<ScannedPRD[]>;
	private updateFrontmatterFn?: (path: string, key: string, value: string) => Promise<void>;

	constructor(options: FeatureLifecycleServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.scanPRDsFn = options.scanPRDs;
		this.updateFrontmatterFn = options.updateFrontmatter;
	}

	/** Set the PRD scanner callback (called from main.ts after vault is ready). */
	setScanner(scanner: () => Promise<ScannedPRD[]>): void {
		this.scanPRDsFn = scanner;
	}

	/** Set the frontmatter update callback (called from main.ts after vault is ready). */
	setUpdateFrontmatter(fn: (path: string, key: string, value: string) => Promise<void>): void {
		this.updateFrontmatterFn = fn;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = {
				sessions: [...(saved.sessions ?? [])],
				activeSession: saved.activeSession ?? null,
			};
		}
		await this.scanFeatures();
	}

	async save(): Promise<void> {
		await this.storage.save(this.state);
	}

	// ── Feature Scanning ────────────────────────────────────

	/** Scan vault PRDs and rebuild the feature list. */
	async scanFeatures(): Promise<FeatureEntry[]> {
		if (!this.scanPRDsFn) {
			this.features = [];
			return this.features;
		}

		const prds = await this.scanPRDsFn();
		this.features = prds.map((prd) => this.parsePRDToEntry(prd));
		return this.features;
	}

	/** Get all scanned features. */
	getFeatures(): FeatureEntry[] {
		return this.features;
	}

	/** Get features grouped by stage. */
	getFeaturesByStage(): Record<FeatureStage, FeatureEntry[]> {
		const grouped: Record<FeatureStage, FeatureEntry[]> = {
			"idea": [],
			"draft": [],
			"approved": [],
			"in-progress": [],
			"review": [],
			"done": [],
		};
		for (const feature of this.features) {
			grouped[feature.stage].push(feature);
		}
		return grouped;
	}

	/** Get a single feature by name. */
	getFeature(name: string): FeatureEntry | undefined {
		return this.features.find((f) => f.name === name);
	}

	// ── State Access ────────────────────────────────────────

	/** Get persisted state (sessions, active session). */
	getState(): FeatureLifecycleState {
		return this.state;
	}

	// ── Stage Transitions ────────────────────────────────────

	/** Advance a feature to the target stage, validating the gate first. */
	async advanceStage(
		featureName: string,
		targetStage: FeatureStage,
		ctx: GateContext,
	): Promise<AdvanceStageResult> {
		const feature = this.features.find((f) => f.name === featureName);
		if (!feature) {
			return { success: false, gateResult: null, error: `Feature "${featureName}" not found` };
		}

		// Validate transition is exactly one step forward
		if (!isValidTransition(feature.stage, targetStage)) {
			return {
				success: false,
				gateResult: null,
				error: `Invalid transition: ${feature.stage} → ${targetStage}`,
			};
		}

		// Run gate check
		const gateResult = runGateCheck(feature, targetStage, ctx);
		if (gateResult && !gateResult.passed) {
			const failedChecks = gateResult.checks.filter((c) => !c.passed);
			void this.eventBus.emit("feature.gate.failed", {
				featureName,
				gateName: gateResult.gate,
				failedChecks,
			});
			return { success: false, gateResult };
		}

		// Gate passed — update in-memory state
		const previousStage = feature.stage;
		feature.stage = targetStage;

		// Update frontmatter in vault
		if (this.updateFrontmatterFn) {
			await this.updateFrontmatterFn(feature.filePath, "stage", targetStage);
		}

		// Emit events
		if (gateResult) {
			const gateName = STAGE_GATE_MAP[targetStage] as GateName;
			void this.eventBus.emit("feature.gate.passed", {
				featureName,
				gateName,
				stage: targetStage,
			});
		}

		void this.eventBus.emit("feature.stage.changed", {
			featureName,
			previousStage,
			newStage: targetStage,
			timestamp: new Date().toISOString(),
		});

		return { success: true, gateResult };
	}

	// ── Session Tracking ─────────────────────────────────────

	/** Start a session for a feature. Returns false if one is already active. */
	startSession(featureName: string): boolean {
		if (this.state.activeSession) return false;

		const feature = this.features.find((f) => f.name === featureName);
		if (!feature) return false;

		const startTime = new Date().toISOString();
		this.state.activeSession = { featureName, startTime };

		void this.eventBus.emit("feature.session.started", { featureName, startTime });
		return true;
	}

	/** End the active session. Returns the completed record or null. */
	endSession(notes = ""): FeatureSessionRecord | null {
		if (!this.state.activeSession) return null;

		const { featureName, startTime } = this.state.activeSession;
		const feature = this.features.find((f) => f.name === featureName);
		const endTime = new Date().toISOString();
		const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

		const record: FeatureSessionRecord = {
			featureName,
			startTime,
			endTime,
			filesCreated: [],
			filesModified: [],
			notes,
			stageAtStart: feature?.stage ?? "idea",
			stageAtEnd: feature?.stage ?? null,
		};

		this.state.sessions.push(record);
		this.state.activeSession = null;

		void this.eventBus.emit("feature.session.ended", {
			featureName,
			endTime,
			duration,
			filesChanged: 0,
		});

		return record;
	}

	/** Get all sessions for a specific feature. */
	getSessionsForFeature(featureName: string): FeatureSessionRecord[] {
		return this.state.sessions.filter((s) => s.featureName === featureName);
	}

	/** Get the active session, or null. */
	getActiveSession(): { featureName: string; startTime: string } | null {
		return this.state.activeSession;
	}

	/** Get aggregate session metrics for a feature. */
	getSessionMetrics(featureName: string): FeatureSessionMetrics {
		return computeFeatureSessionMetrics(this.getSessionsForFeature(featureName));
	}

	/**
	 * Handle a feature.session.ended event from the session domain.
	 * Records the session into the feature's session history.
	 */
	async handleSessionEnded(payload: { featureName: string; endTime: string; duration: number; filesChanged: number }): Promise<void> {
		const feature = this.features.find(f => f.name === payload.featureName);
		if (!feature) return;

		const record = createSessionRecordFromEvent(payload);
		record.stageAtStart = feature.stage;
		record.stageAtEnd = feature.stage;
		this.state.sessions.push(record);
		await this.save();
	}

	// ── Internal ─────────────────────────────────────────────

	/** Parse a scanned PRD into a FeatureEntry with Zod validation. */
	private parsePRDToEntry(prd: ScannedPRD): FeatureEntry {
		const parsed = PRDFrontmatterSchema.safeParse(prd.frontmatter);
		const fm: PRDFrontmatter = parsed.success
			? parsed.data
			: PRDFrontmatterSchema.parse({});

		const rawStage = String(prd.frontmatter.stage ?? "idea");

		return {
			name: prd.name.replace(/ PRD$/, ""),
			filePath: prd.path,
			stage: normalizeStage(rawStage),
			rawStage,
			domain: fm.domain,
			fri: extractFRI(fm),
			prioritization: extractPrioritization(fm),
			pbis: [],
			relatedEvents: fm.related_events,
			maturity: fm.maturity,
		};
	}
}

// ── Pure Functions (exported for testing) ────────────────────

/** Normalize a raw stage string to a valid FeatureStage. */
export function normalizeStage(raw: string): FeatureStage {
	const lower = raw.toLowerCase().trim();

	// Direct match against valid stages
	if ((FEATURE_STAGES as readonly string[]).includes(lower)) {
		return lower as FeatureStage;
	}

	// Legacy mapping
	if (lower in LEGACY_STAGE_MAP) {
		return LEGACY_STAGE_MAP[lower];
	}

	return "idea";
}

/** Extract FRI result from parsed frontmatter. Returns null if no scores present. */
export function extractFRI(fm: PRDFrontmatter): FRIResult | null {
	const dimensions: FRIScores = {
		strategy: fm.maturity_score_strategy ?? 0,
		scope: fm.maturity_score_scope ?? 0,
		architecture: fm.maturity_score_architecture ?? 0,
		event_integration: fm.maturity_score_event_integration ?? 0,
		data_model: fm.maturity_score_data_model ?? 0,
		ui_consistency: fm.maturity_score_ui_consistency ?? 0,
		validation_testing: fm.maturity_score_validation_testing ?? 0,
	};

	// If all dimensions are 0/null, no FRI score exists
	const hasAnyScore = FRI_DIMENSIONS.some((d) => (dimensions[d] ?? 0) > 0);
	if (!hasAnyScore) return null;

	const total = FRI_DIMENSIONS.reduce((sum, d) => sum + (dimensions[d] ?? 0), 0);
	const threshold = FRI_LEVEL_THRESHOLDS.find((t) => total >= t.min)!;

	return {
		dimensions,
		total,
		level: threshold.level,
		levelLabel: threshold.label,
	};
}

/** Extract prioritization result from parsed frontmatter. Returns null if no scores present. */
export function extractPrioritization(fm: PRDFrontmatter): PrioritizationResult | null {
	const dimensions: PrioritizationScores = {
		business_value: fm.business_value,
		implementation_cost: fm.implementation_cost,
		maintenance_cost: fm.maintenance_cost,
		discovery_cost: fm.discovery_cost,
		design_cost: fm.design_cost,
		test_cost: fm.test_cost,
		priority: fm.priority,
	};

	const hasAnyScore = PRIORITIZATION_DIMENSIONS.some((d) => dimensions[d] !== null);
	if (!hasAnyScore) return null;

	// Priority signal: business_value - avg(costs)
	const bv = dimensions.business_value;
	const costs = [
		dimensions.discovery_cost,
		dimensions.design_cost,
		dimensions.implementation_cost,
		dimensions.test_cost,
		dimensions.maintenance_cost,
	].filter((c): c is number => c !== null);

	const signal = bv !== null && costs.length > 0
		? Math.round(bv - costs.reduce((a, b) => a + b, 0) / costs.length)
		: null;

	return { dimensions, signal };
}

/** Get the next stage in the pipeline, or null if at the end. */
export function getNextStage(current: FeatureStage): FeatureStage | null {
	const idx = FEATURE_STAGES.indexOf(current);
	if (idx < 0 || idx >= FEATURE_STAGES.length - 1) return null;
	return FEATURE_STAGES[idx + 1];
}

/** Check if a transition from current to target is valid (exactly one step forward). */
export function isValidTransition(current: FeatureStage, target: FeatureStage): boolean {
	return getNextStage(current) === target;
}
