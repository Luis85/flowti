import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {},
}));

import {
	pluginManifestTemplate,
	pluginPackageTemplate,
} from "../../../src/domain/make/templates.js";

import {
	appManifestTemplate,
	appPackageTemplate,
	appMainTemplate,
	appEventBusTemplate,
} from "../../../src/domain/make/appTemplates.js";

import {
	cliPackageTemplate,
	cliMainTemplate,
	cliMainTestTemplate,
} from "../../../src/domain/make/cliTemplates.js";

// ══════════════════════════════════════════════════════════════════════
// Plugin templates
// ══════════════════════════════════════════════════════════════════════

describe("pluginManifestTemplate", () => {
	const result = pluginManifestTemplate("My Plugin", "my-plugin", "Alice");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains the plugin id", () => {
		expect(JSON.parse(result).id).toBe("my-plugin");
	});

	it("contains the plugin name", () => {
		expect(JSON.parse(result).name).toBe("My Plugin");
	});

	it("contains the author", () => {
		expect(JSON.parse(result).author).toBe("Alice");
	});

	it("contains isDesktopOnly flag", () => {
		expect(JSON.parse(result).isDesktopOnly).toBe(true);
	});
});

describe("pluginPackageTemplate", () => {
	const result = pluginPackageTemplate("My Plugin", "my-plugin");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains the package name from id", () => {
		expect(JSON.parse(result).name).toBe("my-plugin");
	});

	it("contains build scripts", () => {
		const parsed = JSON.parse(result);
		expect(parsed.scripts.build).toBeDefined();
		expect(parsed.scripts.test).toBeDefined();
	});
});

// ══════════════════════════════════════════════════════════════════════
// App templates
// ══════════════════════════════════════════════════════════════════════

describe("appManifestTemplate", () => {
	const result = appManifestTemplate("My App", "my-app", "Bob");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains the app id", () => {
		expect(JSON.parse(result).id).toBe("my-app");
	});

	it("contains the app name", () => {
		expect(JSON.parse(result).name).toBe("My App");
	});

	it("contains the author", () => {
		expect(JSON.parse(result).author).toBe("Bob");
	});
});

describe("appPackageTemplate", () => {
	const result = appPackageTemplate("My App", "my-app");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains the package name from id", () => {
		expect(JSON.parse(result).name).toBe("my-app");
	});

	it("contains build script", () => {
		expect(JSON.parse(result).scripts.build).toBeDefined();
	});

	it("contains test script", () => {
		expect(JSON.parse(result).scripts.test).toBeDefined();
	});

	it("contains check script", () => {
		expect(JSON.parse(result).scripts.check).toBeDefined();
	});
});

describe("appMainTemplate", () => {
	const result = appMainTemplate("My App", "MyApp");

	it("contains the Plugin class", () => {
		expect(result).toContain("class MyAppPlugin extends Plugin");
	});

	it("imports EventBus", () => {
		expect(result).toContain("import { EventBus }");
	});

	it("emits app.loaded on load", () => {
		expect(result).toContain('"app.loaded"');
	});
});

describe("appEventBusTemplate", () => {
	const result = appEventBusTemplate();

	it("contains the EventBus class", () => {
		expect(result).toContain("class EventBus implements IEventBus");
	});

	it("contains emit method", () => {
		expect(result).toContain("async emit");
	});

	it("contains on method", () => {
		expect(result).toContain("on<T extends EventType>");
	});

	it("contains wildcard support", () => {
		expect(result).toContain("WILDCARD");
	});
});

// ══════════════════════════════════════════════════════════════════════
// CLI templates
// ══════════════════════════════════════════════════════════════════════

describe("cliPackageTemplate", () => {
	const result = cliPackageTemplate("My CLI", "my-cli");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains type module", () => {
		expect(JSON.parse(result).type).toBe("module");
	});

	it("contains the package name from id", () => {
		expect(JSON.parse(result).name).toBe("my-cli");
	});

	it("contains dev script", () => {
		expect(JSON.parse(result).scripts.dev).toBeDefined();
	});
});

describe("cliMainTemplate", () => {
	const result = cliMainTemplate("my-cli");

	it("contains shebang", () => {
		expect(result).toContain("#!/usr/bin/env node");
	});

	it("contains help command", () => {
		expect(result).toContain('"help"');
	});

	it("contains the CLI name", () => {
		expect(result).toContain("my-cli");
	});
});

describe("cliMainTestTemplate", () => {
	const result = cliMainTestTemplate("my-cli");

	it("contains a describe block", () => {
		expect(result).toContain('describe("my-cli"');
	});

	it("contains an it block", () => {
		expect(result).toContain("it(");
	});
});
