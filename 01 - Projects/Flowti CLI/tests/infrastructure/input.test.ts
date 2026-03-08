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

describe("input.askYesNo", () => {
	it("returns true when user enters 'y'", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("y");
		});

		expect(await input.askYesNo("Proceed?")).toBe(true);
	});

	it("returns true when user enters 'yes'", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("yes");
		});

		expect(await input.askYesNo("Proceed?")).toBe(true);
	});

	it("returns true when user enters 'Y' (case-insensitive)", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("Y");
		});

		expect(await input.askYesNo("Proceed?")).toBe(true);
	});

	it("returns false when user enters 'n'", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("n");
		});

		expect(await input.askYesNo("Proceed?")).toBe(false);
	});

	it("returns false on empty input when defaultNo is true", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("");
		});

		expect(await input.askYesNo("Proceed?", true)).toBe(false);
	});

	it("returns true on empty input when defaultNo is false", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("");
		});

		expect(await input.askYesNo("Proceed?", false)).toBe(true);
	});

	it("defaults to defaultNo=true when not specified", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("");
		});

		expect(await input.askYesNo("Proceed?")).toBe(false);
	});

	it("shows (y/N) hint when defaultNo is true", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("y");
		});

		await input.askYesNo("Proceed?", true);
		const promptArg = mockQuestion.mock.calls[0][0] as string;
		expect(promptArg).toContain("(y/N)");
	});

	it("shows (Y/n) hint when defaultNo is false", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("y");
		});

		await input.askYesNo("Proceed?", false);
		const promptArg = mockQuestion.mock.calls[0][0] as string;
		expect(promptArg).toContain("(Y/n)");
	});

	it("closes the readline interface after receiving answer", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("y");
		});

		await input.askYesNo("Proceed?");
		expect(mockClose).toHaveBeenCalled();
	});

	it("trims whitespace from answer", async () => {
		mockQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
			cb("  y  ");
		});

		expect(await input.askYesNo("Proceed?")).toBe(true);
	});
});
