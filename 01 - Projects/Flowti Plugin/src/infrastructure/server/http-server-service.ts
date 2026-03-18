/**
 * HTTP client for the Flowti CLI server management endpoints.
 *
 * Endpoints:
 * - GET  /api/server/stats   -> server stats (uptime, connections, agents, storybooks)
 * - GET  /api/server/config  -> current server config
 * - POST /api/server/config  -> update server config
 * - POST /api/server/restart -> restart the CLI server
 */

import type { ServerStats, ServerConfig } from "../../domain/server/types.js";

export class HttpServerService {
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async getStats(): Promise<ServerStats | null> {
		try {
			const res = await fetch(`${this.baseUrl}/api/server/stats`);
			if (!res.ok) return null;
			return await res.json() as ServerStats;
		} catch {
			return null;
		}
	}

	async getConfig(): Promise<ServerConfig | null> {
		try {
			const res = await fetch(`${this.baseUrl}/api/server/config`);
			if (!res.ok) return null;
			return await res.json() as ServerConfig;
		} catch {
			return null;
		}
	}

	async updateConfig(config: Partial<ServerConfig>): Promise<{ ok: boolean }> {
		try {
			const res = await fetch(`${this.baseUrl}/api/server/config`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(config),
			});
			if (!res.ok) return { ok: false };
			return { ok: true };
		} catch {
			return { ok: false };
		}
	}

	async restart(): Promise<{ ok: boolean }> {
		try {
			const res = await fetch(`${this.baseUrl}/api/server/restart`, {
				method: "POST",
			});
			if (!res.ok) return { ok: false };
			return { ok: true };
		} catch {
			return { ok: false };
		}
	}
}
