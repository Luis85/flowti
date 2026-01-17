/**
 * Central export for all test mocks and factories.
 * Import from here for easy access to all mock utilities.
 */

// Re-export everything from factories
export * from "./factories";

// Re-export from obsidian mocks for backward compatibility
export {
	createMockVaultAdapter,
	createMockVault,
	createMockApp,
	createMockSettings,
	createMockMapping,
} from "./obsidian";
