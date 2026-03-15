vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../../../src/infrastructure/shell.js", () => ({ sh: {} }));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({ paths: {} }));

import { createVaultTestProvider } from "../../../../../src/domain/e2e/journey/providers/vault-test-provider.js";
import type { EnvironmentProvider } from "../../../../../src/domain/e2e/journey/journey-environment.js";

describe("createVaultTestProvider", () => {
	it("returns a valid EnvironmentProvider", () => {
		const provider = createVaultTestProvider();
		expect(provider.target).toBe("vault-test");
		expect(provider.label).toBe("Vault Test");
		expect(provider.capabilities).toContain("vault-cli");
		expect(provider.capabilities).toContain("vault-provision");
		expect(provider.capabilities).toContain("vault-project");
		expect(provider.capabilities).toContain("command");
		expect(provider.capabilities).toContain("filesystem");
	});

	it("provides vault-cli tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-cli"]).toBeDefined();
	});

	it("provides vault-project tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-project"]).toBeDefined();
	});

	it("provides vault-assert tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-assert"]).toBeDefined();
	});

	it("has setup and teardown functions", () => {
		const provider = createVaultTestProvider();
		expect(typeof provider.setup).toBe("function");
		expect(typeof provider.teardown).toBe("function");
	});
});
