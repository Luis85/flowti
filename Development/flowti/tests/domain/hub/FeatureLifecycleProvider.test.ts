import { describe, it, expect, vi } from "vitest";
import { FeatureLifecycleProvider } from "../../../src/domain/hub/FeatureLifecycleProvider";
import type { FeatureLifecycleService } from "../../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { FeatureEntry, FeatureStage } from "../../../src/domain/featureLifecycle/types";

function createEntry(overrides: Partial<FeatureEntry> = {}): FeatureEntry {
	return {
		name: "Test",
		filePath: "",
		stage: "idea",
		rawStage: "idea",
		domain: "D1",
		fri: null,
		prioritization: null,
		pbis: [],
		relatedEvents: [],
		maturity: null,
		...overrides,
	};
}

function groupByStage(features: FeatureEntry[]): Record<FeatureStage, FeatureEntry[]> {
	const grouped: Record<FeatureStage, FeatureEntry[]> = {
		idea: [], draft: [], approved: [], "in-progress": [], review: [], done: [],
	};
	for (const f of features) grouped[f.stage].push(f);
	return grouped;
}

function createMockService(features: FeatureEntry[], activeSession: { featureName: string; startTime: string } | null = null) {
	return {
		getFeatures: vi.fn(() => features),
		getFeaturesByStage: vi.fn(() => groupByStage(features)),
		getActiveSession: vi.fn(() => activeSession),
	} as unknown as FeatureLifecycleService;
}

describe("FeatureLifecycleProvider", () => {
	it("returns correct hub id", () => {
		const provider = new FeatureLifecycleProvider(createMockService([]));
		expect(provider.getHubId()).toBe("feature-lifecycle");
	});

	it("returns correct view type", () => {
		const provider = new FeatureLifecycleProvider(createMockService([]));
		expect(provider.getViewType()).toBe("flowti-event-catalog");
	});

	it("returns correct display name", () => {
		const provider = new FeatureLifecycleProvider(createMockService([]));
		expect(provider.getDisplayName()).toBe("Feature Lifecycle");
	});

	it("returns correct icon", () => {
		const provider = new FeatureLifecycleProvider(createMockService([]));
		expect(provider.getIcon()).toBe("sparkles");
	});

	it("returns summary with total features count", () => {
		const features = [
			createEntry({ name: "A", stage: "idea" }),
			createEntry({ name: "B", stage: "in-progress" }),
			createEntry({ name: "C", stage: "done" }),
		];
		const provider = new FeatureLifecycleProvider(createMockService(features));
		const summary = provider.getSummary();
		expect(summary.stats[0]).toMatchObject({ label: "Features", value: "3" });
	});

	it("counts active features (in-progress + review)", () => {
		const features = [
			createEntry({ name: "A", stage: "in-progress" }),
			createEntry({ name: "B", stage: "review" }),
			createEntry({ name: "C", stage: "idea" }),
		];
		const provider = new FeatureLifecycleProvider(createMockService(features));
		const summary = provider.getSummary();
		expect(summary.stats[1]).toMatchObject({ label: "Active", value: "2" });
	});

	it("counts done features", () => {
		const features = [
			createEntry({ name: "A", stage: "done" }),
			createEntry({ name: "B", stage: "done" }),
			createEntry({ name: "C", stage: "idea" }),
		];
		const provider = new FeatureLifecycleProvider(createMockService(features));
		const summary = provider.getSummary();
		expect(summary.stats[2]).toMatchObject({ label: "Done", value: "2" });
	});

	it("returns action item count 1 when session is active", () => {
		const provider = new FeatureLifecycleProvider(
			createMockService([], { featureName: "A", startTime: "2026-03-06T10:00:00Z" }),
		);
		const summary = provider.getSummary();
		expect(summary.actionItemCount).toBe(1);
	});

	it("returns action item count 0 when no session is active", () => {
		const provider = new FeatureLifecycleProvider(createMockService([]));
		expect(provider.getSummary().actionItemCount).toBe(0);
	});
});
