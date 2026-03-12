import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PRODUCTS_DIR: "/vault/02 - Products",
	FEATURES_DIR: "/vault/03 - Features",
}));

import { listProducts, listFeatures, getProductPath, getFeaturePath } from "../../../src/domain/lifecycle/discovery.js";

const mockDisk = {
	readdirSync: vi.fn(() => []),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const deps = { disk: mockDisk as any, paths: mockPaths as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("listProducts", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.readdirSync.mockImplementation(() => { throw new Error("ENOENT"); });
		expect(listProducts(deps)).toEqual([]);
	});

	it("lists product directories sorted", () => {
		mockDisk.readdirSync.mockReturnValue([
			{ name: "Zeta Platform", isDirectory: () => true },
			{ name: "Alpha Service", isDirectory: () => true },
			{ name: "README.md", isDirectory: () => false },
		]);
		expect(listProducts(deps)).toEqual(["Alpha Service", "Zeta Platform"]);
	});
});

describe("listFeatures", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.readdirSync.mockImplementation(() => { throw new Error("ENOENT"); });
		expect(listFeatures(deps)).toEqual([]);
	});

	it("lists feature directories sorted", () => {
		mockDisk.readdirSync.mockReturnValue([
			{ name: "User Auth", isDirectory: () => true },
			{ name: "Search", isDirectory: () => true },
		]);
		expect(listFeatures(deps)).toEqual(["Search", "User Auth"]);
	});
});

describe("getProductPath", () => {
	it("resolves path under products directory", () => {
		expect(getProductPath("Flowti Platform", deps)).toBe("/vault/02 - Products/Flowti Platform");
	});
});

describe("getFeaturePath", () => {
	it("resolves path under features directory", () => {
		expect(getFeaturePath("User Auth", deps)).toBe("/vault/03 - Features/User Auth");
	});
});
