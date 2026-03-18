import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpServerService } from "../../../src/infrastructure/server/http-server-service.js";
import type { ServerStats, ServerConfig } from "../../../src/domain/server/types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) };
}

describe("HttpServerService", () => {
	let service: HttpServerService;

	beforeEach(() => {
		mockFetch.mockReset();
		service = new HttpServerService("http://localhost:3000");
	});

	describe("getStats", () => {
		it("returns ServerStats on success", async () => {
			const payload: ServerStats = {
				uptime: 120,
				connections: 3,
				agentCount: 2,
				storybookProcesses: [{ project: "demo", pid: 1234, url: "http://localhost:6006" }],
			};
			mockFetch.mockResolvedValueOnce(jsonResponse(payload));

			const result = await service.getStats();

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/server/stats");
			expect(result).toEqual(payload);
		});

		it("returns null on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

			const result = await service.getStats();

			expect(result).toBeNull();
		});

		it("returns null on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network failure"));

			const result = await service.getStats();

			expect(result).toBeNull();
		});
	});

	describe("getConfig", () => {
		it("returns ServerConfig on success", async () => {
			const payload: ServerConfig = { port: 3000, logLevel: "info", autoConnect: true };
			mockFetch.mockResolvedValueOnce(jsonResponse(payload));

			const result = await service.getConfig();

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/server/config");
			expect(result).toEqual(payload);
		});

		it("returns null on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));

			const result = await service.getConfig();

			expect(result).toBeNull();
		});

		it("returns null on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

			const result = await service.getConfig();

			expect(result).toBeNull();
		});
	});

	describe("updateConfig", () => {
		it("posts partial config and returns ok on success", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.updateConfig({ port: 4000 });

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/server/config",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ port: 4000 }),
				}),
			);
			expect(result).toEqual({ ok: true });
		});

		it("returns ok false on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

			const result = await service.updateConfig({ logLevel: "debug" });

			expect(result).toEqual({ ok: false });
		});

		it("returns ok false on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Timeout"));

			const result = await service.updateConfig({ autoConnect: false });

			expect(result).toEqual({ ok: false });
		});
	});

	describe("restart", () => {
		it("posts to restart endpoint and returns ok on success", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, message: "Restart signal received" }));

			const result = await service.restart();

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/server/restart",
				expect.objectContaining({ method: "POST" }),
			);
			expect(result).toEqual({ ok: true });
		});

		it("returns ok false on non-OK response", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}, 503));

			const result = await service.restart();

			expect(result).toEqual({ ok: false });
		});

		it("returns ok false on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Connection reset"));

			const result = await service.restart();

			expect(result).toEqual({ ok: false });
		});
	});
});
