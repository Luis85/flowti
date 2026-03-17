import { describe, it, expect } from "vitest";
import {
	mapHttpError,
	isTransientError,
	isNetworkError,
	parseRetryAfter,
} from "../../../src/domain/signal/adapters/AzureDevOpsAdapter";

describe("mapHttpError()", () => {
	it("returns PAT error for 401", () => {
		expect(mapHttpError(401)).toBe("Invalid Personal Access Token");
	});

	it("returns permissions error for 403", () => {
		expect(mapHttpError(403)).toContain("Insufficient permissions");
	});

	it("returns project-not-found for 404", () => {
		expect(mapHttpError(404)).toContain("Project not found");
	});

	it("returns rate limit message for 429 without Retry-After", () => {
		expect(mapHttpError(429)).toContain("Rate limited");
	});

	it("includes Retry-After value for 429 with header", () => {
		const msg = mapHttpError(429, { "retry-after": "30" });
		expect(msg).toContain("30 seconds");
	});

	it("returns service error for 500+", () => {
		expect(mapHttpError(500)).toContain("service error");
		expect(mapHttpError(502)).toContain("service error");
		expect(mapHttpError(503)).toContain("service error");
	});

	it("returns generic message for unknown status", () => {
		expect(mapHttpError(418)).toContain("Connection failed");
	});
});

describe("isTransientError()", () => {
	it("returns true for 429", () => {
		expect(isTransientError(429)).toBe(true);
	});

	it("returns true for 502, 503, 504", () => {
		expect(isTransientError(502)).toBe(true);
		expect(isTransientError(503)).toBe(true);
		expect(isTransientError(504)).toBe(true);
	});

	it("returns false for 401, 403, 404, 500", () => {
		expect(isTransientError(401)).toBe(false);
		expect(isTransientError(403)).toBe(false);
		expect(isTransientError(404)).toBe(false);
		expect(isTransientError(500)).toBe(false);
	});
});

describe("isNetworkError()", () => {
	it("detects ECONNREFUSED", () => {
		expect(isNetworkError(new Error("connect ECONNREFUSED 127.0.0.1:443"))).toBe(true);
	});

	it("detects ETIMEDOUT", () => {
		expect(isNetworkError(new Error("connect ETIMEDOUT 1.2.3.4:443"))).toBe(true);
	});

	it("detects ENOTFOUND", () => {
		expect(isNetworkError(new Error("getaddrinfo ENOTFOUND dev.azure.com"))).toBe(true);
	});

	it("detects fetch failed", () => {
		expect(isNetworkError(new Error("fetch failed"))).toBe(true);
	});

	it("detects generic network error", () => {
		expect(isNetworkError(new Error("NetworkError when attempting to fetch"))).toBe(true);
	});

	it("returns false for non-network errors", () => {
		expect(isNetworkError(new Error("JSON parse error"))).toBe(false);
		expect(isNetworkError(new Error("timeout"))).toBe(false);
	});

	it("returns false for non-Error values", () => {
		expect(isNetworkError("string")).toBe(false);
		expect(isNetworkError(null)).toBe(false);
		expect(isNetworkError(42)).toBe(false);
	});
});

describe("parseRetryAfter()", () => {
	it("parses retry-after header (lowercase)", () => {
		expect(parseRetryAfter({ "retry-after": "30" })).toBe(30_000);
	});

	it("parses Retry-After header (capitalized)", () => {
		expect(parseRetryAfter({ "Retry-After": "5" })).toBe(5_000);
	});

	it("returns null for missing header", () => {
		expect(parseRetryAfter({})).toBeNull();
		expect(parseRetryAfter(undefined)).toBeNull();
	});

	it("returns null for non-numeric header", () => {
		expect(parseRetryAfter({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" })).toBeNull();
	});

	it("prefers lowercase header", () => {
		expect(parseRetryAfter({ "retry-after": "10", "Retry-After": "20" })).toBe(10_000);
	});
});
