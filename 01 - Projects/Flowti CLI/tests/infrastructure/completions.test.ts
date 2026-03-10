import { describe, it, expect } from "vitest";
import {
	generateBashCompletions,
	generateZshCompletions,
	generateFishCompletions,
	generatePowerShellCompletions,
	generateCompletions,
} from "../../src/infrastructure/completions.js";

const commands = ["help", "build", "test", "health", "info"];

describe("generateBashCompletions", () => {
	it("produces a bash completion script", () => {
		const result = generateBashCompletions(commands);
		expect(result).toContain("_flowti_completions");
		expect(result).toContain("compgen -W");
		expect(result).toContain("help build test health info");
		expect(result).toContain("complete -F");
	});

	it("uses custom binary name", () => {
		const result = generateBashCompletions(commands, "mycli");
		expect(result).toContain("_mycli_completions");
		expect(result).toContain("complete -F _mycli_completions mycli");
	});
});

describe("generateZshCompletions", () => {
	it("produces a zsh completion script", () => {
		const result = generateZshCompletions(commands);
		expect(result).toContain("_flowti()");
		expect(result).toContain("compdef");
		expect(result).toContain('"help"');
	});
});

describe("generateFishCompletions", () => {
	it("produces a fish completion script with one line per command", () => {
		const result = generateFishCompletions(commands);
		expect(result).toContain("complete -c flowti -f -a");
		const lines = result.split("\n").filter((l) => l.startsWith("complete"));
		expect(lines).toHaveLength(5);
	});
});

describe("generatePowerShellCompletions", () => {
	it("produces a PowerShell completion script", () => {
		const result = generatePowerShellCompletions(commands);
		expect(result).toContain("Register-ArgumentCompleter");
		expect(result).toContain("CompletionResult");
		expect(result).toContain('"help"');
	});
});

describe("generateCompletions", () => {
	it("dispatches to bash", () => {
		expect(generateCompletions("bash", commands)).toContain("compgen");
	});

	it("dispatches to zsh", () => {
		expect(generateCompletions("zsh", commands)).toContain("compdef");
	});

	it("dispatches to fish", () => {
		expect(generateCompletions("fish", commands)).toContain("complete -c");
	});

	it("dispatches to powershell", () => {
		expect(generateCompletions("powershell", commands)).toContain("Register-ArgumentCompleter");
	});

	it("dispatches to pwsh alias", () => {
		expect(generateCompletions("pwsh", commands)).toContain("Register-ArgumentCompleter");
	});

	it("returns null for unknown shell", () => {
		expect(generateCompletions("tcsh", commands)).toBeNull();
	});
});
