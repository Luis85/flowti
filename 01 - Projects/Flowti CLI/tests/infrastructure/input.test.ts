import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock readline before importing the module under test
const mockQuestion = vi.fn();
const mockClose = vi.fn();
vi.mock("node:readline", () => ({
	default: {
		createInterface: vi.fn(() => ({
			question: mockQuestion,
			close: mockClose,
		})),
	},
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "[RESET]",
	DIM: "[DIM]",
}));

import readline from "node:readline";
import { input } from "../../src/infrastructure/input.js";

const mockedCreateInterface = vi.mocked(readline.createInterface);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("input.ask", () => {
	it("resolves with the user's trimmed answer", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("  hello world  ");
		});

		const result = await input.ask("Enter name");
		expect(result).toBe("hello world");
	});

	it("creates a readline interface with stdin/stdout", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("answer");
		});

		await input.ask("Question");
		expect(mockedCreateInterface).toHaveBeenCalledWith({
			input: process.stdin,
			output: process.stdout,
		});
	});

	it("closes the readline interface after receiving answer", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("answer");
		});

		await input.ask("Question");
		expect(mockClose).toHaveBeenCalled();
	});

	it("returns the default value when user enters empty string", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("");
		});

		const result = await input.ask("Enter name", "default-name");
		expect(result).toBe("default-name");
	});

	it("returns the default value when user enters only whitespace", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("   ");
		});

		const result = await input.ask("Enter name", "fallback");
		expect(result).toBe("fallback");
	});

	it("returns empty string when no default and user enters nothing", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("");
		});

		const result = await input.ask("Enter name");
		expect(result).toBe("");
	});

	it("includes default value hint in the prompt when provided", async () => {
		mockQuestion.mockImplementation((prompt: string, cb: (answer: string) => void) => {
			cb("answer");
		});

		await input.ask("Enter name", "John");
		const promptArg = mockQuestion.mock.calls[0][0] as string;
		expect(promptArg).toContain("Enter name");
		expect(promptArg).toContain("[DIM]");
		expect(promptArg).toContain("(John)");
		expect(promptArg).toContain("[RESET]");
	});

	it("does not include default hint when no default is provided", async () => {
		mockQuestion.mockImplementation((prompt: string, cb: (answer: string) => void) => {
			cb("answer");
		});

		await input.ask("Enter name");
		const promptArg = mockQuestion.mock.calls[0][0] as string;
		expect(promptArg).toContain("Enter name");
		expect(promptArg).not.toContain("[DIM]");
	});

	it("prefers user input over default value", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("custom");
		});

		const result = await input.ask("Enter name", "default");
		expect(result).toBe("custom");
	});
});
