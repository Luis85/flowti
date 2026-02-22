/**
 * Azure DevOps adapter for the Signal domain.
 *
 * Implements the SignalAdapter interface using Obsidian's `requestUrl()`
 * to communicate with the Azure DevOps REST API (v7.1).
 *
 * Authentication: PAT → Base64 Basic auth header (`:${pat}` → base64).
 * See ADR-034 for HTTP integration patterns.
 */

import { requestUrl } from "obsidian";
import type { SignalConfig, WorkItemMapping, SyncError } from "../types";
import type { SignalAdapter, TestConnectionResult, FetchItemsResult } from "./SignalAdapter";

/** Maximum work item IDs per batch GET request (Azure DevOps limit). */
const BATCH_SIZE = 200;

/** Azure DevOps REST API version. */
const API_VERSION = "7.1";

// ── Error messages (user-friendly, never include PAT) ─────────

function mapHttpError(status: number, headers?: Record<string, string>): string {
	switch (status) {
		case 401:
			return "Invalid Personal Access Token";
		case 403:
			return "Insufficient permissions — PAT needs Work Items (Read) scope";
		case 404:
			return "Project not found — check organization URL and project name";
		case 429: {
			const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
			return retryAfter
				? `Rate limited — retry after ${retryAfter} seconds`
				: "Rate limited — try again later";
		}
		default:
			if (status >= 500) {
				return "Azure DevOps service error — try again later";
			}
			return "Connection failed — check your network and organization URL";
	}
}

// ── Field mapping ─────────────────────────────────────────────

interface AzureDevOpsWorkItem {
	id: number;
	rev: number;
	fields: Record<string, unknown>;
	_links?: { html?: { href?: string } };
}

function mapWorkItem(raw: AzureDevOpsWorkItem): WorkItemMapping {
	const f = raw.fields;
	const assignedTo = f["System.AssignedTo"];
	const tagsRaw = f["System.Tags"];

	return {
		id: raw.id,
		rev: raw.rev,
		type: (f["System.WorkItemType"] as string) ?? "",
		title: (f["System.Title"] as string) ?? "",
		state: (f["System.State"] as string) ?? "",
		assignedTo: typeof assignedTo === "object" && assignedTo !== null
			? ((assignedTo as { displayName?: string }).displayName ?? "")
			: "",
		areaPath: (f["System.AreaPath"] as string) ?? "",
		iterationPath: (f["System.IterationPath"] as string) ?? "",
		priority: typeof f["Microsoft.VSTS.Common.Priority"] === "number"
			? (f["Microsoft.VSTS.Common.Priority"] as number)
			: 0,
		tags: typeof tagsRaw === "string" && tagsRaw.length > 0
			? tagsRaw.split("; ")
			: [],
		url: raw._links?.html?.href ?? "",
		description: (f["System.Description"] as string) ?? "",
		createdDate: (f["System.CreatedDate"] as string) ?? "",
		changedDate: (f["System.ChangedDate"] as string) ?? "",
	};
}

// ── Adapter ───────────────────────────────────────────────────

export class AzureDevOpsAdapter implements SignalAdapter {

	private buildAuthHeaders(pat: string): Record<string, string> {
		const token = btoa(`:${pat}`);
		return {
			"Authorization": `Basic ${token}`,
			"Content-Type": "application/json",
		};
	}

	private async apiRequest(
		url: string,
		config: SignalConfig,
		body?: unknown,
	): Promise<{ json: unknown; status: number; headers: Record<string, string> }> {
		const response = await requestUrl({
			url,
			method: body ? "POST" : "GET",
			headers: this.buildAuthHeaders(config.pat),
			body: body ? JSON.stringify(body) : undefined,
		});
		return { json: response.json, status: response.status, headers: response.headers };
	}

	// ── Public API ──────────────────────────────────────────

	async testConnection(config: SignalConfig): Promise<TestConnectionResult> {
		const url = `${config.orgUrl}/_apis/projects/${encodeURIComponent(config.project)}?api-version=${API_VERSION}-preview.1`;

		try {
			await this.apiRequest(url, config);
			return { success: true };
		} catch (err: unknown) {
			const status = (err as { status?: number }).status;
			const headers = (err as { headers?: Record<string, string> }).headers;
			if (typeof status === "number") {
				return { success: false, error: mapHttpError(status, headers) };
			}
			return { success: false, error: "Connection failed — check your network and organization URL" };
		}
	}

	async fetchItems(config: SignalConfig): Promise<FetchItemsResult> {
		// Step 1: WIQL query for work item IDs
		const wiqlUrl = `${config.orgUrl}/${encodeURIComponent(config.project)}/_apis/wit/wiql?api-version=${API_VERSION}`;
		let wiqlQuery = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${config.project}'`;

		if (config.itemTypeFilter.length > 0) {
			const types = config.itemTypeFilter.map(t => `'${t}'`).join(", ");
			wiqlQuery += ` AND [System.WorkItemType] IN (${types})`;
		}

		let wiqlResult: { workItems?: Array<{ id: number }> };
		try {
			const response = await this.apiRequest(wiqlUrl, config, { query: wiqlQuery });
			wiqlResult = response.json as { workItems?: Array<{ id: number }> };
		} catch (err: unknown) {
			const status = (err as { status?: number }).status;
			const headers = (err as { headers?: Record<string, string> }).headers;
			const message = typeof status === "number"
				? mapHttpError(status, headers)
				: "Connection failed — check your network and organization URL";
			return { items: [], errors: [{ workItemId: 0, message, recoverable: false }] };
		}

		const ids = wiqlResult.workItems?.map(wi => wi.id) ?? [];
		if (ids.length === 0) {
			return { items: [], errors: [] };
		}

		// Step 2: Batch fetch work item details
		const items: WorkItemMapping[] = [];
		const errors: SyncError[] = [];

		for (let i = 0; i < ids.length; i += BATCH_SIZE) {
			const batch = ids.slice(i, i + BATCH_SIZE);
			const batchUrl = `${config.orgUrl}/${encodeURIComponent(config.project)}/_apis/wit/workitems?ids=${batch.join(",")}&$expand=all&api-version=${API_VERSION}`;

			try {
				const response = await this.apiRequest(batchUrl, config);
				const data = response.json as { value?: AzureDevOpsWorkItem[] };

				for (const raw of data.value ?? []) {
					try {
						items.push(mapWorkItem(raw));
					} catch (err: unknown) {
						const detail = err instanceof Error ? err.message : String(err);
						errors.push({
							workItemId: raw.id,
							message: `Failed to map work item fields: ${detail}`,
							recoverable: true,
						});
					}
				}
			} catch (err: unknown) {
				const status = (err as { status?: number }).status;
				const headers = (err as { headers?: Record<string, string> }).headers;
				const message = typeof status === "number"
					? mapHttpError(status, headers)
					: "Connection failed — check your network and organization URL";
				for (const id of batch) {
					errors.push({ workItemId: id, message, recoverable: false });
				}
			}
		}

		return { items, errors };
	}
}
