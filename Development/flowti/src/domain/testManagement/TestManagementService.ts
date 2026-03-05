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
import { computePyramid } from "./pyramidCalculator";
import { computeCoverage, type PrdInfo } from "./coverageCalculator";
import { checkCompliance } from "./complianceChecker";
import { COMPLIANCE_CHARACTERISTICS } from "./complianceDefinitions";

/** Configuration options for TestManagementService. */
export interface TestManagementServiceOptions {
	storage: ITypedStorage<TestManagementState>;
	eventBus?: IEventBus;
}

export class TestManagementService {
	private state: TestManagementState = createDefaultState();
	private storage: ITypedStorage<TestManagementState>;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(options: TestManagementServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = { ...createDefaultState(), ...saved };
		}
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

	private wireEventSubscriptions(): void {
		if (!this.eventBus) return;
		// Will listen for journey-builder.exported in Inc 6 (JB Integration)
	}

	private async save(): Promise<void> {
		await this.storage.save(this.state);
	}
}
