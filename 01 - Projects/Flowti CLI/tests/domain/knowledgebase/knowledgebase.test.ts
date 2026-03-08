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

vi.mock("../../../src/infrastructure/readline.js", () => ({
	createRL: vi.fn(() => ({ close: vi.fn() })),
	ask: vi.fn(),
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	printHeader: vi.fn(),
	BOLD: "", RESET: "", DIM: "", CYAN: "", YELLOW: "", GREEN: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { isKnowledgebaseAvailable } from "../../../src/domain/knowledgebase/knowledgebase.js";

describe("isKnowledgebaseAvailable", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns true when CLI is available and vault is initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable()).toBe(true);
	});

	it("returns false when CLI is not available", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});

	it("returns false when vault is not initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});

	it("returns false when both are unavailable", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});
});
