/**
 * Test Management domain service.
 *
 * Thin orchestrator that manages the journey registry, delegates to
 * pure calculation modules for pyramid, coverage, and compliance,
 * and emits domain events for UI consumers.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type {
	TestManagementState,
	JourneyRegistryEntry,
	TestPyramidState,
	CoverageEntry,
	ComplianceScore,
} from "./types";
import { createDefaultState } from "./types";
import { parseJourneyDefinition, parseJourneyResult, deriveJourneyStatus } from "./journeyParser";
import { applyTrends, computePyramid } from "./pyramidCalculator";
import { computeCoverage, type PrdInfo } from "./coverageCalculator";
import { checkCompliance } from "./complianceChecker";
import { COMPLIANCE_CHARACTERISTICS } from "./complianceDefinitions";

/** A discovered journey JSON file with its vault path. */
export interface ScannedJourney {
	json: Record<string, unknown>;
	path: string;
}

/** Configuration options for TestManagementService. */
export interface TestManagementServiceOptions {
	storage: ITypedStorage<TestManagementState>;
	eventBus?: IEventBus;
	/** Optional callback that scans the vault for journey JSON files on load. */
	scanJourneys?: () => Promise<ScannedJourney[]>;
}

export class TestManagementService {
	private state: TestManagementState = createDefaultState();
	private storage: ITypedStorage<TestManagementState>;
	private eventBus?: IEventBus;
	private scanJourneys?: () => Promise<ScannedJourney[]>;
	private scanPrdsFn?: () => Promise<PrdInfo[]>;
	private prds: PrdInfo[] = [];
	private unsubscribes: (() => void)[] = [];

	constructor(options: TestManagementServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.scanJourneys = options.scanJourneys;
	}

	/** Set the vault scanner callback (called before load). */
	setScanner(scanner: () => Promise<ScannedJourney[]>): void {
		this.scanJourneys = scanner;
	}

	/** Set the PRD scanner callback (called during load). */
	setPrdScanner(scanner: () => Promise<PrdInfo[]>): void {
		this.scanPrdsFn = scanner;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = { ...createDefaultState(), ...saved };
		}
		await this.scanVaultJourneys();
		await this.scanVaultPrds();
		this.wireEventSubscriptions();
		await this.eventBus?.emit("test-mgmt.hub.loaded", {
			journeyCount: this.state.journeys.length,
			coveragePercent: 0,
		});
	}

	dispose(): void {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	// ── Queries ──────────────────────────────────────────────

	getJourneys(): JourneyRegistryEntry[] {
		return this.state.journeys;
	}

	getJourneyByName(name: string): JourneyRegistryEntry | undefined {
		return this.state.journeys.find((j) => j.name === name);
	}

	getPyramid(): TestPyramidState {
		return computePyramid(this.state.journeys);
	}

	/** Get pyramid with trend indicators (compared to stored baseline). */
	getPyramidWithTrends(): TestPyramidState {
		const current = this.getPyramid();
		if (!this.state.pyramidBaseline) return current;
		return applyTrends(current, this.state.pyramidBaseline);
	}

	getBaseline(): TestPyramidState | undefined {
		return this.state.pyramidBaseline;
	}

	/** Snapshot the current pyramid as baseline for future trend comparison. */
	setBaseline(): void {
		this.state.pyramidBaseline = this.getPyramid();
		void this.save();
	}

	getPrds(): PrdInfo[] {
		return this.prds;
	}

	getCoverage(prds: PrdInfo[]): CoverageEntry[] {
		return computeCoverage(prds, this.state.journeys);
	}

	getCompliance(): ComplianceScore[] {
		return checkCompliance(COMPLIANCE_CHARACTERISTICS, this.state.complianceTags);
	}

	// ── Mutations ────────────────────────────────────────────

	registerJourney(json: Record<string, unknown>): JourneyRegistryEntry | null {
		const entry = parseJourneyDefinition(json);
		if (!entry) return null;

		// Upsert: replace existing entry with same name
		const idx = this.state.journeys.findIndex((j) => j.name === entry.name);
		if (idx >= 0) {
			// Preserve run history from existing entry
			entry.runHistory = this.state.journeys[idx].runHistory;
			entry.lastRunResult = this.state.journeys[idx].lastRunResult;
			// Preserve compliance tags
			entry.complianceTags = [
				...new Set([...entry.complianceTags, ...(this.state.journeys[idx].complianceTags ?? [])]),
			];
			this.state.journeys[idx] = entry;
		} else {
			this.state.journeys.push(entry);
		}

		void this.save();
		void this.eventBus?.emit("test-mgmt.journey.registered", {
			name: entry.name,
			domain: entry.domain,
			stepCount: entry.stepCount,
		});

		return entry;
	}

	deregisterJourney(name: string): boolean {
		const idx = this.state.journeys.findIndex((j) => j.name === name);
		if (idx < 0) return false;

		this.state.journeys.splice(idx, 1);
		delete this.state.complianceTags[name];
		void this.save();
		void this.eventBus?.emit("test-mgmt.journey.deregistered", { name });
		return true;
	}

	recordRunResult(journeyName: string, resultJson: Record<string, unknown>): void {
		const entry = this.getJourneyByName(journeyName);
		if (!entry) return;

		const summary = parseJourneyResult(resultJson);
		if (!summary) return;

		const oldStatus = deriveJourneyStatus(entry);
		entry.runHistory.push(summary);
		entry.lastRunResult = summary;
		const newStatus = deriveJourneyStatus(entry);

		void this.save();
		void this.eventBus?.emit("test-mgmt.journey.run-completed", {
			name: journeyName,
			passed: summary.passed,
			failed: summary.failed,
			skipped: summary.skipped,
		});

		if (oldStatus !== newStatus) {
			void this.eventBus?.emit("test-mgmt.journey.status-changed", {
				name: journeyName,
				oldStatus,
				newStatus,
			});
		}
	}

	addComplianceTag(journeyName: string, tagId: string): void {
		if (!this.state.complianceTags[journeyName]) {
			this.state.complianceTags[journeyName] = [];
		}
		if (!this.state.complianceTags[journeyName].includes(tagId)) {
			this.state.complianceTags[journeyName].push(tagId);
			void this.save();
		}
	}

	removeComplianceTag(journeyName: string, tagId: string): void {
		const tags = this.state.complianceTags[journeyName];
		if (!tags) return;
		const idx = tags.indexOf(tagId);
		if (idx >= 0) {
			tags.splice(idx, 1);
			void this.save();
		}
	}

	// ── Internal ─────────────────────────────────────────────

	/** Scan vault for journey JSON files and register any new/updated ones. */
	private async scanVaultJourneys(): Promise<void> {
		if (!this.scanJourneys) return;
		try {
			const scanned = await this.scanJourneys();
			for (const { json, path } of scanned) {
				const entry = parseJourneyDefinition(json);
				if (!entry) continue;
				entry.jsonPath = path;

				const idx = this.state.journeys.findIndex((j) => j.name === entry.name);
				if (idx >= 0) {
					// Preserve run history + compliance from persisted entry
					entry.runHistory = this.state.journeys[idx].runHistory;
					entry.lastRunResult = this.state.journeys[idx].lastRunResult;
					entry.complianceTags = [
						...new Set([...entry.complianceTags, ...(this.state.journeys[idx].complianceTags ?? [])]),
					];
					this.state.journeys[idx] = entry;
				} else {
					this.state.journeys.push(entry);
				}
			}
			if (scanned.length > 0) await this.save();
		} catch {
			// Scan failure is non-fatal — logged but doesn't block startup
		}
	}

	/** Scan vault for PRD files and store their info in memory. */
	private async scanVaultPrds(): Promise<void> {
		if (!this.scanPrdsFn) return;
		try {
			this.prds = await this.scanPrdsFn();
		} catch {
			// Scan failure is non-fatal
		}
	}

	/** Request a Three Amigos review for a journey. */
	requestReview(journeyName: string): void {
		void this.eventBus?.emit("test-mgmt.review.requested", { journeyName });
	}

	private wireEventSubscriptions(): void {
		if (!this.eventBus) return;

		// Auto-register journeys on export from Journey Builder
		this.unsubscribes.push(
			this.eventBus.on("journey-builder.exported", (event) => {
				const { definition, path, testFilePath, canvasPath } = event.payload;
				const entry = this.registerJourney(definition);
				if (entry) {
					entry.jsonPath = path;
					if (testFilePath) entry.testSourcePath = testFilePath;
					if (canvasPath) entry.canvasPath = canvasPath;
					void this.save();
				}
			}),
		);
	}

	private async save(): Promise<void> {
		await this.storage.save(this.state);
	}
}
