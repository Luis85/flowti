/**
 * Azure DevOps adapter for the Signal domain.
 *
 * Implements the SignalAdapter interface using Obsidian's `requestUrl()`
 * to communicate with the Azure DevOps REST API (v7.1).
 *
 * Hardened with:
 * - Exponential backoff retry (3 attempts, 1s/2s/4s)
 * - Token expiry detection (401)
 * - Rate limit handling (429 + Retry-After header)
 * - Network failure handling (ECONNREFUSED/ETIMEDOUT)
 * - Contextual error messages (never includes PAT)
 */

import { requestUrl } from "obsidian";
import type { SignalConfig, WorkItemMapping, SyncError } from "../types";
import type { SignalAdapter, TestConnectionResult, FetchItemsResult } from "./SignalAdapter";

/** Maximum work item IDs per batch GET request (Azure DevOps limit). */
const BATCH_SIZE = 200;

/** Azure DevOps REST API version. */
const API_VERSION = "7.1";

/** Maximum retry attempts for transient failures. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff. */
const BASE_DELAY_MS = 1000;

/** Injectable delay function for testing. */
export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Error classification ─────────────────────────────────────────

/** Returns true for HTTP status codes that should be retried. */
export function isTransientError(status: number): boolean {
	return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Returns true for network errors that should be retried. */
export function isNetworkError(err: unknown): boolean {
	if (err instanceof Error) {
		const msg = err.message.toLowerCase();
		return msg.includes("econnrefused")
			|| msg.includes("etimedout")
			|| msg.includes("enotfound")
			|| msg.includes("network")
			|| msg.includes("fetch failed");
	}
	return false;
}

/** Extracts the Retry-After header value in milliseconds, or null. */
export function parseRetryAfter(headers?: Record<string, string>): number | null {
	const value = headers?.["retry-after"] ?? headers?.["Retry-After"];
	if (!value) return null;
	const seconds = parseInt(value, 10);
	return isNaN(seconds) ? null : seconds * 1000;
}

// ── Error messages (user-friendly, never include PAT) ─────────

export function mapHttpError(status: number, headers?: Record<string, string>): string {
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

export interface AzureDevOpsAdapterOptions {
	delay?: DelayFn;
}

export class AzureDevOpsAdapter implements SignalAdapter {
	private readonly delay: DelayFn;

	constructor(options?: AzureDevOpsAdapterOptions) {
		this.delay = options?.delay ?? defaultDelay;
	}

	private buildAuthHeaders(pat: string): Record<string, string> {
		const token = btoa(`:${pat}`);
		return {
			"Authorization": `Basic ${token}`,
			"Content-Type": "application/json",
		};
	}

	/** API request with exponential backoff retry on transient errors. */
	private async apiRequestWithRetry(
		url: string,
		config: SignalConfig,
		body?: unknown,
	): Promise<{ json: unknown; status: number; headers: Record<string, string> }> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await requestUrl({
					url,
					method: body ? "POST" : "GET",
					headers: this.buildAuthHeaders(config.pat),
					body: body ? JSON.stringify(body) : undefined,
				});
				return { json: response.json, status: response.status, headers: response.headers };
			} catch (err: unknown) {
				lastError = err;
				const status = (err as { status?: number }).status;
				const headers = (err as { headers?: Record<string, string> }).headers;

				// Non-retryable HTTP errors — throw immediately
				if (typeof status === "number" && !isTransientError(status)) {
					throw err;
				}

				if (attempt < MAX_RETRIES) {
					if (status === 429) {
						const retryAfterMs = parseRetryAfter(headers) ?? BASE_DELAY_MS * Math.pow(2, attempt - 1);
						await this.delay(retryAfterMs);
						continue;
					}
					if ((typeof status === "number" && isTransientError(status)) || isNetworkError(err)) {
						await this.delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
						continue;
					}
				}
			}
		}

		throw lastError;
	}

	// ── Public API ──────────────────────────────────────────

	async testConnection(config: SignalConfig): Promise<TestConnectionResult> {
		const url = `${config.orgUrl}/_apis/projects/${encodeURIComponent(config.project)}?api-version=${API_VERSION}-preview.1`;

		try {
			await this.apiRequestWithRetry(url, config);
			return { success: true };
		} catch (err: unknown) {
			const status = (err as { status?: number }).status;
			const headers = (err as { headers?: Record<string, string> }).headers;
			if (typeof status === "number") {
				return { success: false, error: mapHttpError(status, headers) };
			}
			if (isNetworkError(err)) {
				return { success: false, error: `Network error: ${(err as Error).message}` };
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
			const response = await this.apiRequestWithRetry(wiqlUrl, config, { query: wiqlQuery });
			wiqlResult = response.json as { workItems?: Array<{ id: number }> };
		} catch (err: unknown) {
			const status = (err as { status?: number }).status;
			const headers = (err as { headers?: Record<string, string> }).headers;
			const message = typeof status === "number"
				? mapHttpError(status, headers)
				: isNetworkError(err)
					? `Network error: ${(err as Error).message}`
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
				const response = await this.apiRequestWithRetry(batchUrl, config);
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
					: isNetworkError(err)
						? `Network error: ${(err as Error).message}`
						: "Connection failed — check your network and organization URL";
				for (const id of batch) {
					errors.push({ workItemId: id, message, recoverable: false });
				}
			}
		}

		return { items, errors };
	}
}
