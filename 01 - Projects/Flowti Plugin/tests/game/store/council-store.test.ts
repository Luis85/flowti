import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardStore } from "../../../src/game/store/dashboard-store.js";

describe("Council state", () => {
	let store: DashboardStore;
	let storage: Record<string, string>;

	beforeEach(() => {
		store = new DashboardStore();
		storage = {};
		vi.stubGlobal("localStorage", {
			getItem: vi.fn((key: string) => storage[key] ?? null),
			setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
			removeItem: vi.fn((key: string) => { delete storage[key]; }),
		});
	});

	it("defaults to empty array", () => {
		expect(store.council).toEqual([]);
	});

	describe("addToCouncil", () => {
		it("appends a name", () => {
			store.addToCouncil("Atlas");
			expect(store.council).toEqual(["Atlas"]);
		});

		it("enforces max 5", () => {
			for (const name of ["a", "b", "c", "d", "e"]) store.addToCouncil(name);
			store.addToCouncil("f");
			expect(store.council).toHaveLength(5);
			expect(store.council).not.toContain("f");
		});

		it("rejects duplicates", () => {
			store.addToCouncil("Atlas");
			store.addToCouncil("Atlas");
			expect(store.council).toEqual(["Atlas"]);
		});

		it("persists to localStorage", () => {
			store.addToCouncil("Atlas");
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"flowti-council",
				JSON.stringify(["Atlas"]),
			);
		});
	});

	describe("removeFromCouncil", () => {
		it("removes by name", () => {
			store.addToCouncil("Atlas");
			store.addToCouncil("Bob");
			store.removeFromCouncil("Atlas");
			expect(store.council).toEqual(["Bob"]);
		});

		it("no-op for unknown name", () => {
			store.addToCouncil("Atlas");
			const spy = vi.fn();
			store.addEventListener("state-changed", spy);
			store.removeFromCouncil("Unknown");
			expect(store.council).toEqual(["Atlas"]);
			expect(spy).not.toHaveBeenCalled();
		});

		it("persists to localStorage", () => {
			store.addToCouncil("Atlas");
			store.addToCouncil("Bob");
			vi.mocked(localStorage.setItem).mockClear();
			store.removeFromCouncil("Atlas");
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"flowti-council",
				JSON.stringify(["Bob"]),
			);
		});
	});

	describe("setCouncil", () => {
		it("replaces list", () => {
			store.addToCouncil("Atlas");
			store.setCouncil(["Bob", "Eve"]);
			expect(store.council).toEqual(["Bob", "Eve"]);
		});

		it("truncates to 5", () => {
			store.setCouncil(["a", "b", "c", "d", "e", "f", "g"]);
			expect(store.council).toHaveLength(5);
		});

		it("persists to localStorage", () => {
			store.setCouncil(["Atlas"]);
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"flowti-council",
				JSON.stringify(["Atlas"]),
			);
		});
	});

	describe("reorderCouncil", () => {
		it("replaces order", () => {
			store.setCouncil(["Atlas", "Bob", "Eve"]);
			store.reorderCouncil(["Eve", "Bob", "Atlas"]);
			expect(store.council).toEqual(["Eve", "Bob", "Atlas"]);
		});
	});
});

describe("TabName migration", () => {
	it("selectedTab defaults to profile", () => {
		const store = new DashboardStore();
		expect(store.selectedTab).toBe("profile");
	});

	it("selectTab('profile') works", () => {
		const store = new DashboardStore();
		store.selectTab("talk");
		store.selectTab("profile");
		expect(store.selectedTab).toBe("profile");
	});

	it("falls back to profile for unknown tab", () => {
		const store = new DashboardStore();
		// Cast to bypass compile-time check — simulates runtime invalid value
		store.selectTab("info" as "profile");
		expect(store.selectedTab).toBe("profile");
	});
});
