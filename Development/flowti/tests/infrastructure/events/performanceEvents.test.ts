import { describe, it, expect, vi } from "vitest";
import {
	EVENT_CATALOG,
	INTERNAL_EVENT_PREFIXES,
	getEventsByCategory,
	getEventEntry,
} from "../../../src/infrastructure/events/catalog";
import { TypedStorage } from "../../../src/utils/TypedStorage";
import type { IStorageProvider } from "../../../src/utils/types";
import type { StorageMeasure } from "../../../src/utils/TypedStorage";

function createMockStorage(initial: Record<string, unknown> = {}): {
	storage: IStorageProvider;
} {
	let data = { ...initial };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (d: unknown) => { data = d as Record<string, unknown>; }),
		},
	};
}

describe("Performance Observability Events", () => {
	describe("catalog entries", () => {
		it("should include perf.storage.loaded in the catalog", () => {
			const entry = getEventEntry("perf.storage.loaded");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
			expect(entry?.tags).toContain("system");
		});

		it("should include perf.storage.saved in the catalog", () => {
			const entry = getEventEntry("perf.storage.saved");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
			expect(entry?.tags).toContain("system");
		});

		it("should include perf.startup.service in the catalog", () => {
			const entry = getEventEntry("perf.startup.service");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
		});

		it("should include perf.startup.total in the catalog", () => {
			const entry = getEventEntry("perf.startup.total");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
		});

		it("should include perf.query.executed in the catalog", () => {
			const entry = getEventEntry("perf.query.executed");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
		});

		it("should include perf.alert in the catalog", () => {
			const entry = getEventEntry("perf.alert");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
			expect(entry?.tags).toContain("system");
		});

		it("should include perf.event.dispatched in the catalog", () => {
			const entry = getEventEntry("perf.event.dispatched");
			expect(entry).toBeDefined();
			expect(entry?.category).toBe("Performance");
			expect(entry?.tags).toContain("system");
		});

		it("should have exactly 7 Performance category entries", () => {
			const entries = getEventsByCategory("Performance");
			expect(entries).toHaveLength(7);
		});

		it("should mark all perf events as system-internal visibility", () => {
			const entries = getEventsByCategory("Performance");
			for (const entry of entries) {
				expect(entry.visibility).toBe("system-internal");
			}
		});

		it("should tag all perf events with system tag", () => {
			const entries = getEventsByCategory("Performance");
			for (const entry of entries) {
				expect(entry.tags).toContain("system");
			}
		});
	});

	describe("internal event prefix", () => {
		it("should include perf. in INTERNAL_EVENT_PREFIXES", () => {
			expect(INTERNAL_EVENT_PREFIXES).toContain("perf.");
		});

		it("should filter perf events from wildcard listeners", () => {
			const perfEvents = EVENT_CATALOG.filter((e) => e.type.startsWith("perf."));
			expect(perfEvents.length).toBe(7);
			for (const ev of perfEvents) {
				const isInternal = INTERNAL_EVENT_PREFIXES.some((p) => ev.type.startsWith(p));
				expect(isInternal).toBe(true);
			}
		});
	});

	describe("TypedStorage onMeasure callback", () => {
		it("should call onMeasure on load with timing data", async () => {
			const onMeasure: StorageMeasure = vi.fn();
			const { storage } = createMockStorage({ myKey: { value: "test" } });
			const typed = new TypedStorage<{ value: string }>(storage, "myKey", { onMeasure });

			await typed.load();

			expect(onMeasure).toHaveBeenCalledOnce();
			expect(onMeasure).toHaveBeenCalledWith(
				"loaded",
				"myKey",
				expect.any(Number),
				expect.any(Number),
			);
			const call = (onMeasure as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[2]).toBeGreaterThanOrEqual(0); // durationMs
			expect(call[3]).toBeGreaterThan(0); // sizeBytes > 0 when data exists
		});

		it("should report 0 sizeBytes on load when key is missing", async () => {
			const onMeasure: StorageMeasure = vi.fn();
			const { storage } = createMockStorage({});
			const typed = new TypedStorage<string>(storage, "missing", { onMeasure });

			await typed.load();

			expect(onMeasure).toHaveBeenCalledWith("loaded", "missing", expect.any(Number), 0);
		});

		it("should call onMeasure on save with timing data", async () => {
			const onMeasure: StorageMeasure = vi.fn();
			const { storage } = createMockStorage();
			const typed = new TypedStorage<{ count: number }>(storage, "myKey", { onMeasure });

			await typed.save({ count: 42 });

			expect(onMeasure).toHaveBeenCalledOnce();
			expect(onMeasure).toHaveBeenCalledWith(
				"saved",
				"myKey",
				expect.any(Number),
				expect.any(Number),
			);
			const call = (onMeasure as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[2]).toBeGreaterThanOrEqual(0); // durationMs
			expect(call[3]).toBeGreaterThan(0); // sizeBytes
		});

		it("should not call onMeasure when not provided", async () => {
			const { storage } = createMockStorage({ k: "v" });
			const typed = new TypedStorage<string>(storage, "k");

			// Should not throw
			await typed.load();
			await typed.save("updated");
		});

		it("should report accurate sizeBytes for saved state", async () => {
			const onMeasure: StorageMeasure = vi.fn();
			const { storage } = createMockStorage();
			const state = { name: "hello", items: [1, 2, 3] };
			const typed = new TypedStorage<typeof state>(storage, "k", { onMeasure });

			await typed.save(state);

			const call = (onMeasure as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[3]).toBe(JSON.stringify(state).length);
		});
	});
});
