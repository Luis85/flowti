import { describe, it, expect } from "vitest";
import {
	resolveEntityPath,
	getEventDocPathResolved,
	getDomainDocPathResolved,
	getArchitectureDocPathResolved,
	getServiceDocPathResolved,
	getServiceBlueprintPathResolved,
	getCategoryDocPathResolved,
	getFlowDocPathResolved,
	getSystemDocPathResolved,
	getActorDocPathResolved,
	getProductDocPathResolved,
} from "../../../src/domain/docs/pathResolver";

// ─────────────────────────────────────────────────────────────
// resolveEntityPath
// ─────────────────────────────────────────────────────────────

describe("resolveEntityPath", () => {
	it("returns overridePath when set", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "custom/events/path",
		});
		expect(result).toBe("custom/events/path");
	});

	it("returns overridePath trimmed of whitespace", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "  custom/path  ",
		});
		expect(result).toBe("custom/path");
	});

	it("strips trailing slashes from overridePath", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "custom/path///",
		});
		expect(result).toBe("custom/path");
	});

	it("strips trailing slashes and whitespace from overridePath together", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "  custom/path//  ",
		});
		expect(result).toBe("custom/path");
	});

	it("falls back to docsRootPath + subfolder when overridePath is empty string", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "",
		});
		expect(result).toBe("docs/root/Events");
	});

	it("falls back to docsRootPath + subfolder when overridePath is whitespace-only", () => {
		const result = resolveEntityPath("docs/root", {
			subfolder: "Events",
			overridePath: "   ",
		});
		expect(result).toBe("docs/root/Events");
	});

	it("strips trailing slashes from docsRootPath in fallback mode", () => {
		const result = resolveEntityPath("docs/root///", {
			subfolder: "Flows",
			overridePath: "",
		});
		expect(result).toBe("docs/root/Flows");
	});

	it("handles docsRootPath that is a single segment", () => {
		const result = resolveEntityPath("vault", {
			subfolder: "Domains",
			overridePath: "",
		});
		expect(result).toBe("vault/Domains");
	});
});

// ─────────────────────────────────────────────────────────────
// Resolved path functions (pre-resolved entity folder)
// ─────────────────────────────────────────────────────────────

describe("getEventDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getEventDocPathResolved("docs/Events", "user.created")).toBe(
			"docs/Events/user.created.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getEventDocPathResolved("docs/Events/", "user.created")).toBe(
			"docs/Events/user.created.md",
		);
	});

	it("handles special chars in event type", () => {
		expect(getEventDocPathResolved("docs/Events", "ns.my-event_v2")).toBe(
			"docs/Events/ns.my-event_v2.md",
		);
	});
});

describe("getDomainDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getDomainDocPathResolved("docs/Domains", "Auth")).toBe(
			"docs/Domains/Auth.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getDomainDocPathResolved("docs/Domains/", "Auth")).toBe(
			"docs/Domains/Auth.md",
		);
	});

	it("handles special chars in domain name", () => {
		expect(getDomainDocPathResolved("docs/Domains", "Data-Exchange_v2")).toBe(
			"docs/Domains/Data-Exchange_v2.md",
		);
	});
});

describe("getArchitectureDocPathResolved", () => {
	it("returns .architecture.md suffix", () => {
		expect(getArchitectureDocPathResolved("docs/Domains", "Auth")).toBe(
			"docs/Domains/Auth.architecture.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getArchitectureDocPathResolved("docs/Domains/", "Auth")).toBe(
			"docs/Domains/Auth.architecture.md",
		);
	});

	it("handles special chars in domain name", () => {
		expect(getArchitectureDocPathResolved("docs/Domains", "my-domain")).toBe(
			"docs/Domains/my-domain.architecture.md",
		);
	});
});

describe("getServiceDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getServiceDocPathResolved("docs/Services", "AuthService")).toBe(
			"docs/Services/AuthService.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getServiceDocPathResolved("docs/Services/", "AuthService")).toBe(
			"docs/Services/AuthService.md",
		);
	});

	it("handles special chars in service name", () => {
		expect(getServiceDocPathResolved("docs/Services", "my_svc-2")).toBe(
			"docs/Services/my_svc-2.md",
		);
	});
});

describe("getServiceBlueprintPathResolved", () => {
	it("returns .blueprint.md suffix", () => {
		expect(getServiceBlueprintPathResolved("docs/Services", "AuthService")).toBe(
			"docs/Services/AuthService.blueprint.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getServiceBlueprintPathResolved("docs/Services/", "AuthService")).toBe(
			"docs/Services/AuthService.blueprint.md",
		);
	});

	it("handles special chars in service name", () => {
		expect(getServiceBlueprintPathResolved("docs/Services", "my_svc-2")).toBe(
			"docs/Services/my_svc-2.blueprint.md",
		);
	});
});

describe("getCategoryDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getCategoryDocPathResolved("docs/Categories", "Core")).toBe(
			"docs/Categories/Core.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getCategoryDocPathResolved("docs/Categories/", "Core")).toBe(
			"docs/Categories/Core.md",
		);
	});

	it("handles special chars in category name", () => {
		expect(getCategoryDocPathResolved("docs/Categories", "Data Exchange")).toBe(
			"docs/Categories/Data Exchange.md",
		);
	});
});

describe("getFlowDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getFlowDocPathResolved("docs/Flows", "UserOnboarding")).toBe(
			"docs/Flows/UserOnboarding.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getFlowDocPathResolved("docs/Flows/", "UserOnboarding")).toBe(
			"docs/Flows/UserOnboarding.md",
		);
	});

	it("handles special chars in flow name", () => {
		expect(getFlowDocPathResolved("docs/Flows", "my-flow_v2")).toBe(
			"docs/Flows/my-flow_v2.md",
		);
	});
});

describe("getSystemDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getSystemDocPathResolved("docs/Systems", "Backend")).toBe(
			"docs/Systems/Backend.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getSystemDocPathResolved("docs/Systems/", "Backend")).toBe(
			"docs/Systems/Backend.md",
		);
	});

	it("handles special chars in system name", () => {
		expect(getSystemDocPathResolved("docs/Systems", "API-Gateway")).toBe(
			"docs/Systems/API-Gateway.md",
		);
	});
});

describe("getActorDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getActorDocPathResolved("docs/Actors", "Admin")).toBe(
			"docs/Actors/Admin.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getActorDocPathResolved("docs/Actors/", "Admin")).toBe(
			"docs/Actors/Admin.md",
		);
	});

	it("handles special chars in actor name", () => {
		expect(getActorDocPathResolved("docs/Actors", "end-user_v2")).toBe(
			"docs/Actors/end-user_v2.md",
		);
	});
});

describe("getProductDocPathResolved", () => {
	it("returns basic path", () => {
		expect(getProductDocPathResolved("docs/Products", "Dashboard")).toBe(
			"docs/Products/Dashboard.md",
		);
	});

	it("strips trailing slash from folder", () => {
		expect(getProductDocPathResolved("docs/Products/", "Dashboard")).toBe(
			"docs/Products/Dashboard.md",
		);
	});

	it("handles special chars in product name", () => {
		expect(getProductDocPathResolved("docs/Products", "my-product_v3")).toBe(
			"docs/Products/my-product_v3.md",
		);
	});
});

