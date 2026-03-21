import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsCliAvailable = vi.fn();
const mockIsVaultInitialized = vi.fn();

vi.mock("../../../src/domain/knowledgebase/vault-service.js", () => ({
	isCliAvailable: () => mockIsCliAvailable(),
	isVaultInitialized: () => mockIsVaultInitialized(),
	listFolder: vi.fn(),
	readMarkdownFile: vi.fn(),
	searchVault: vi.fn(),
}));

import { isKnowledgebaseAvailable } from "../../../src/domain/knowledgebase/knowledgebase.js";

const stubDeps = { disk: {} as never, paths: {} as never, shell: {} as never };

describe("isKnowledgebaseAvailable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns true when CLI is available and vault is initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable("/vault", stubDeps)).toBe(true);
	});

	it("returns false when CLI is not available", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable("/vault", stubDeps)).toBe(false);
	});

	it("returns false when vault is not initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable("/vault", stubDeps)).toBe(false);
	});

	it("returns false when both are unavailable", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable("/vault", stubDeps)).toBe(false);
	});
});
