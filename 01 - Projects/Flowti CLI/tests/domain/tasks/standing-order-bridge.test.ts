import { describe, it, expect } from "vitest";
import { buildEntriesFromMatches, type IndexedOrder } from "../../../src/domain/tasks/standing-order-index.js";

function makeOrder(overrides: Partial<IndexedOrder> = {}): IndexedOrder {
	return {
		taskId: "so-001",
		assignee: "auditor",
		watchFolder: "00 - Inbox",
		watchEvent: "file-created",
		rules: [],
		...overrides,
	};
}

describe("buildEntriesFromMatches", () => {
	it("converts matched orders into TaskEntry objects", () => {
		const clock = { ms: () => 5000 };
		const matches = [makeOrder()];

		const entries = buildEntriesFromMatches(matches, clock);

		expect(entries).toHaveLength(1);
		expect(entries[0].taskId).toBe("so-5000-0");
		expect(entries[0].source).toBe("standing-order");
		expect(entries[0].targetAgent).toBe("auditor");
		expect(entries[0].priority).toBe("normal");
		expect(entries[0].submittedAt).toBe(5000);
	});

	it("generates unique taskIds for multiple matches", () => {
		const clock = { ms: () => 3000 };
		const matches = [makeOrder(), makeOrder({ taskId: "so-002" })];

		const entries = buildEntriesFromMatches(matches, clock);

		expect(entries[0].taskId).toBe("so-3000-0");
		expect(entries[1].taskId).toBe("so-3000-1");
	});

	it("sets targetAgent to undefined when assignee is empty", () => {
		const clock = { ms: () => 1000 };
		const matches = [makeOrder({ assignee: "" })];

		const entries = buildEntriesFromMatches(matches, clock);

		expect(entries[0].targetAgent).toBeUndefined();
	});

	it("returns empty array for no matches", () => {
		const clock = { ms: () => 1000 };
		const entries = buildEntriesFromMatches([], clock);
		expect(entries).toHaveLength(0);
	});

	it("includes watch info in title", () => {
		const clock = { ms: () => 1000 };
		const matches = [makeOrder({ watchEvent: "file-created", watchFolder: "inbox" })];

		const entries = buildEntriesFromMatches(matches, clock);

		expect(entries[0].title).toContain("file-created");
		expect(entries[0].title).toContain("inbox");
	});
});
