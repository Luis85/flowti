import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	fetchWorldState,
	fetchAgent,
	sendMessage,
	assignTask,
	grantPermission,
} from "../../src/data/api-client.js";

const BASE = "http://localhost:3000";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockReset();
});

describe("fetchWorldState", () => {
	it("returns parsed WorldState on success", async () => {
		const ws = { version: 1, updatedAt: "", entities: {}, permissions: {}, activityLog: [] };
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ws) });
		const result = await fetchWorldState(BASE);
		expect(result).toEqual(ws);
		expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/world-state`);
	});

	it("returns null on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });
		expect(await fetchWorldState(BASE)).toBeNull();
	});

	it("returns null on network error", async () => {
		mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
		expect(await fetchWorldState(BASE)).toBeNull();
	});
});

describe("fetchAgent", () => {
	it("returns entity on success", async () => {
		const entity = { id: "Bob", type: "agent", components: {} };
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(entity) });
		const result = await fetchAgent(BASE, "Bob");
		expect(result).toEqual(entity);
		expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/agent/Bob`);
	});

	it("returns null on failure", async () => {
		mockFetch.mockResolvedValueOnce({ ok: false });
		expect(await fetchAgent(BASE, "Bob")).toBeNull();
	});
});

describe("sendMessage", () => {
	it("formats the request correctly", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
		const result = await sendMessage(BASE, "Bob", "Hello");
		expect(result).toEqual({ ok: true });
		expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/agent/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName: "Bob", message: "Hello" }),
		});
	});

	it("returns error on network failure", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Network error"));
		const result = await sendMessage(BASE, "Bob", "Hello");
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Network error");
	});
});

describe("assignTask", () => {
	it("includes the task and agentName", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
		const result = await assignTask(BASE, "Bob", "Fix the bug");
		expect(result).toEqual({ ok: true });
		expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/agent/task`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName: "Bob", task: "Fix the bug" }),
		});
	});

	it("returns error on network failure", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Timeout"));
		const result = await assignTask(BASE, "Bob", "Fix the bug");
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Timeout");
	});
});

describe("grantPermission", () => {
	it("sends the decision", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
		const result = await grantPermission(BASE, "Bob", "file_write", "allow");
		expect(result).toEqual({ ok: true });
		expect(mockFetch).toHaveBeenCalledWith(`${BASE}/api/agent/permission`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName: "Bob", tool: "file_write", decision: "allow" }),
		});
	});

	it("returns error on network failure", async () => {
		mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
		const result = await grantPermission(BASE, "Bob", "file_write", "allow");
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Connection refused");
	});
});
