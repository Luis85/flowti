import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SignalConfig } from "../../../src/domain/signal/types";

// ── Mock requestUrl before importing the adapter ──────────────
const { mockRequestUrl } = vi.hoisted(() => ({
	mockRequestUrl: vi.fn(),
}));

vi.mock("obsidian", async (importOriginal) => {
	const actual = await importOriginal() as Record<string, unknown>;
	return { ...actual, requestUrl: mockRequestUrl };
});

import { AzureDevOpsAdapter } from "../../../src/domain/signal/adapters/AzureDevOpsAdapter";

// ── Helpers ───────────────────────────────────────────────────

function makeConfig(overrides: Partial<SignalConfig> = {}): SignalConfig {
	return {
		id: "sig_test",
		name: "Test Signal",
		type: "azure-devops",
		orgUrl: "https://dev.azure.com/myorg",
		project: "MyProject",
		pat: "secret-pat-token",
		targetFolder: "resources/signals/myproject/items",
		itemTypeFilter: ["Bug", "User Story"],
		conflictStrategy: "update",
		lastSync: null,
		lastSyncItemCount: 0,
		status: "disconnected",
		...overrides,
	};
}

function makeWiqlResponse(ids: number[]): { workItems: Array<{ id: number; url: string }> } {
	return {
		workItems: ids.map(id => ({
			id,
			url: `https://dev.azure.com/myorg/MyProject/_apis/wit/workitems/${id}`,
		})),
	};
}

function makeWorkItemFields(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		"System.WorkItemType": "Bug",
		"System.Title": "Fix login button",
		"System.State": "Active",
		"System.AssignedTo": { displayName: "Jane Doe", uniqueName: "jane@example.com" },
		"System.AreaPath": "MyProject\\Area1",
		"System.IterationPath": "MyProject\\Sprint 1",
		"Microsoft.VSTS.Common.Priority": 2,
		"System.Tags": "frontend; urgent",
		"System.Description": "<p>The login button is broken</p>",
		"System.CreatedDate": "2026-02-01T10:00:00Z",
		"System.ChangedDate": "2026-02-20T15:30:00Z",
		...overrides,
	};
}

function makeWorkItemsResponse(items: Array<{ id: number; rev?: number; fields?: Record<string, unknown>; links?: { html?: { href?: string } } }>): { value: unknown[] } {
	return {
		value: items.map(item => ({
			id: item.id,
			rev: item.rev ?? 1,
			fields: item.fields ?? makeWorkItemFields(),
			_links: item.links ?? { html: { href: `https://dev.azure.com/myorg/MyProject/_workitems/edit/${item.id}` } },
		})),
	};
}

function httpError(status: number, headers: Record<string, string> = {}): Error & { status: number; headers: Record<string, string> } {
	const err = new Error(`HTTP ${status}`) as Error & { status: number; headers: Record<string, string> };
	err.status = status;
	err.headers = headers;
	return err;
}

// ── Tests ─────────────────────────────────────────────────────

describe("AzureDevOpsAdapter", () => {
	let adapter: AzureDevOpsAdapter;

	beforeEach(() => {
		adapter = new AzureDevOpsAdapter({ delay: async () => {} });
		mockRequestUrl.mockReset();
	});

	// ── testConnection ────────────────────────────────────────

	describe("testConnection", () => {
		it("should return success for valid connection", async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				headers: {},
				json: { id: "project-id", name: "MyProject" },
				text: "",
			});

			const result = await adapter.testConnection(makeConfig());

			expect(result).toEqual({ success: true });
			expect(mockRequestUrl).toHaveBeenCalledOnce();
		});

		it("should include project in the URL", async () => {
			mockRequestUrl.mockResolvedValue({ status: 200, headers: {}, json: {}, text: "" });

			await adapter.testConnection(makeConfig({ project: "My Project" }));

			const calledUrl = mockRequestUrl.mock.calls[0][0].url as string;
			expect(calledUrl).toContain("My%20Project");
			expect(calledUrl).toContain("api-version=7.1-preview.1");
		});

		it("should return error for invalid PAT (401)", async () => {
			mockRequestUrl.mockRejectedValue(httpError(401));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid Personal Access Token");
		});

		it("should return error for insufficient permissions (403)", async () => {
			mockRequestUrl.mockRejectedValue(httpError(403));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain("Insufficient permissions");
		});

		it("should return error for project not found (404)", async () => {
			mockRequestUrl.mockRejectedValue(httpError(404));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain("Project not found");
		});

		it("should return error for rate limiting (429) with Retry-After", async () => {
			mockRequestUrl.mockRejectedValue(httpError(429, { "Retry-After": "30" }));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain("Rate limited");
			expect(result.error).toContain("30");
		});

		it("should return error for server error (500)", async () => {
			mockRequestUrl.mockRejectedValue(httpError(500));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain("Azure DevOps service error");
		});

		it("should return error for network failure", async () => {
			mockRequestUrl.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:443"));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain("Network error");
			expect(result.error).toContain("ECONNREFUSED");
		});
	});

	// ── fetchItems ────────────────────────────────────────────

	describe("fetchItems", () => {
		it("should fetch work items via WIQL + batch GET", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([101, 102]), text: "" })
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWorkItemsResponse([{ id: 101 }, { id: 102 }]), text: "" });

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(2);
			expect(result.errors).toHaveLength(0);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		});

		it("should apply type filter to WIQL query", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([]), text: "" });

			await adapter.fetchItems(makeConfig({ itemTypeFilter: ["Bug", "Task"] }));

			const body = JSON.parse(mockRequestUrl.mock.calls[0][0].body as string) as { query: string };
			expect(body.query).toContain("[System.WorkItemType] IN ('Bug', 'Task')");
		});

		it("should not add type filter when itemTypeFilter is empty", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([]), text: "" });

			await adapter.fetchItems(makeConfig({ itemTypeFilter: [] }));

			const body = JSON.parse(mockRequestUrl.mock.calls[0][0].body as string) as { query: string };
			expect(body.query).not.toContain("WorkItemType");
		});

		it("should handle empty result set", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([]), text: "" });

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		it("should batch requests for >200 work items", async () => {
			const ids = Array.from({ length: 250 }, (_, i) => i + 1);
			const batch1Items = ids.slice(0, 200).map(id => ({ id }));
			const batch2Items = ids.slice(200).map(id => ({ id }));

			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse(ids), text: "" })
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWorkItemsResponse(batch1Items), text: "" })
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWorkItemsResponse(batch2Items), text: "" });

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(250);
			expect(mockRequestUrl).toHaveBeenCalledTimes(3);

			// Verify batch URLs contain correct ID ranges
			const batch1Url = mockRequestUrl.mock.calls[1][0].url as string;
			const batch2Url = mockRequestUrl.mock.calls[2][0].url as string;
			expect(batch1Url).toContain("ids=1,2,3");
			expect(batch2Url).toContain("ids=201,202,203");
		});

		it("should map all Azure DevOps fields correctly", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([42]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 42,
						rev: 5,
						fields: makeWorkItemFields(),
						links: { html: { href: "https://dev.azure.com/myorg/MyProject/_workitems/edit/42" } },
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(1);
			const item = result.items[0];
			expect(item.id).toBe(42);
			expect(item.rev).toBe(5);
			expect(item.type).toBe("Bug");
			expect(item.title).toBe("Fix login button");
			expect(item.state).toBe("Active");
			expect(item.assignedTo).toBe("Jane Doe");
			expect(item.areaPath).toBe("MyProject\\Area1");
			expect(item.iterationPath).toBe("MyProject\\Sprint 1");
			expect(item.priority).toBe(2);
			expect(item.tags).toEqual(["frontend", "urgent"]);
			expect(item.url).toBe("https://dev.azure.com/myorg/MyProject/_workitems/edit/42");
			expect(item.description).toBe("<p>The login button is broken</p>");
			expect(item.createdDate).toBe("2026-02-01T10:00:00Z");
			expect(item.changedDate).toBe("2026-02-20T15:30:00Z");
		});

		it("should handle missing optional fields gracefully", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 1,
						fields: {
							"System.WorkItemType": "Task",
							"System.Title": "Minimal item",
							"System.State": "New",
							"System.AreaPath": "Proj",
							"System.IterationPath": "Proj\\Sprint 1",
							"System.CreatedDate": "2026-01-01T00:00:00Z",
							"System.ChangedDate": "2026-01-01T00:00:00Z",
							// No AssignedTo, no Tags, no Priority, no Description
						},
						links: {},
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(1);
			const item = result.items[0];
			expect(item.assignedTo).toBe("");
			expect(item.tags).toEqual([]);
			expect(item.priority).toBe(0);
			expect(item.description).toBe("");
			expect(item.url).toBe("");
		});

		it("should handle WIQL query failure gracefully", async () => {
			mockRequestUrl.mockRejectedValue(httpError(401));

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].message).toBe("Invalid Personal Access Token");
			expect(result.errors[0].recoverable).toBe(false);
		});

		it("should handle batch fetch failure and report errors per item", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1, 2, 3]), text: "" })
				.mockRejectedValueOnce(httpError(500));

			const result = await adapter.fetchItems(makeConfig());

			expect(result.items).toHaveLength(0);
			expect(result.errors).toHaveLength(3);
			expect(result.errors[0].workItemId).toBe(1);
			expect(result.errors[0].message).toContain("Azure DevOps service error");
		});
	});

	// ── field mapping edge cases ──────────────────────────────

	describe("field mapping", () => {
		it("should split tags by '; ' separator", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 1,
						fields: makeWorkItemFields({ "System.Tags": "alpha; beta; gamma" }),
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());
			expect(result.items[0].tags).toEqual(["alpha", "beta", "gamma"]);
		});

		it("should handle empty tags string", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 1,
						fields: makeWorkItemFields({ "System.Tags": "" }),
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());
			expect(result.items[0].tags).toEqual([]);
		});

		it("should extract displayName from AssignedTo object", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 1,
						fields: makeWorkItemFields({
							"System.AssignedTo": { displayName: "John Smith", uniqueName: "john@example.com" },
						}),
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());
			expect(result.items[0].assignedTo).toBe("John Smith");
		});

		it("should default priority to 0 when missing", async () => {
			mockRequestUrl
				.mockResolvedValueOnce({ status: 200, headers: {}, json: makeWiqlResponse([1]), text: "" })
				.mockResolvedValueOnce({
					status: 200, headers: {}, text: "",
					json: makeWorkItemsResponse([{
						id: 1,
						fields: makeWorkItemFields({ "Microsoft.VSTS.Common.Priority": undefined }),
					}]),
				});

			const result = await adapter.fetchItems(makeConfig());
			expect(result.items[0].priority).toBe(0);
		});
	});

	// ── security ──────────────────────────────────────────────

	describe("security", () => {
		it("should send PAT as Base64 Basic auth header", async () => {
			mockRequestUrl.mockResolvedValue({ status: 200, headers: {}, json: {}, text: "" });

			await adapter.testConnection(makeConfig({ pat: "my-secret-pat" }));

			const headers = mockRequestUrl.mock.calls[0][0].headers as Record<string, string>;
			const expected = btoa(":my-secret-pat");
			expect(headers["Authorization"]).toBe(`Basic ${expected}`);
		});

		it("should never include PAT in error messages on testConnection failure", async () => {
			mockRequestUrl.mockRejectedValue(httpError(401));

			const result = await adapter.testConnection(makeConfig({ pat: "super-secret-token" }));

			expect(result.error).not.toContain("super-secret-token");
		});

		it("should never include PAT in error objects on fetchItems failure", async () => {
			mockRequestUrl.mockRejectedValue(httpError(403));

			const result = await adapter.fetchItems(makeConfig({ pat: "super-secret-token" }));

			for (const error of result.errors) {
				expect(error.message).not.toContain("super-secret-token");
			}
		});
	});

	// ── error mapping ─────────────────────────────────────────

	describe("error mapping", () => {
		const errorCases: Array<[number, string]> = [
			[401, "Invalid Personal Access Token"],
			[403, "Insufficient permissions"],
			[404, "Project not found"],
			[500, "Azure DevOps service error"],
			[503, "Azure DevOps service error"],
		];

		it.each(errorCases)("should map HTTP %i to '%s'", async (status, expectedSubstring) => {
			mockRequestUrl.mockRejectedValue(httpError(status));

			const result = await adapter.testConnection(makeConfig());

			expect(result.success).toBe(false);
			expect(result.error).toContain(expectedSubstring);
		});

		it("should extract Retry-After from 429 response", async () => {
			mockRequestUrl.mockRejectedValue(httpError(429, { "Retry-After": "60" }));

			const result = await adapter.testConnection(makeConfig());

			expect(result.error).toContain("60 seconds");
		});

		it("should handle 429 without Retry-After header", async () => {
			mockRequestUrl.mockRejectedValue(httpError(429));

			const result = await adapter.testConnection(makeConfig());

			expect(result.error).toContain("Rate limited");
			expect(result.error).toContain("try again later");
		});
	});
});
