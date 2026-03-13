import { describe, it, expect } from "vitest";
import { buildTraceabilityMatrix, findUnlinkedRequirements, findUnlinkedComponents } from "../../../../src/domain/make/component/component-traceability.js";
import { buildProductViews, buildFeatureList } from "../../../../src/domain/make/component/component-product.js";
import { buildArc42View, c4ToArc42Level } from "../../../../src/domain/make/component/component-arc42.js";
import type { ProjectComponent } from "../../../../src/domain/make/component/component-types.js";
import type { RequirementSummary } from "../../../../src/domain/requirements/requirement-types.js";

function makeComp(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
	return {
		name: "Comp", kind: "component", status: "active", isDirty: false,
		definitionPath: "", generatedDir: "",
		...overrides,
	} as ProjectComponent;
}

function makeReq(overrides: Partial<RequirementSummary> = {}): RequirementSummary {
	return { name: "Req", id: "REQ-001", requirementType: "functional", status: "approved", priority: "must", file: "", ...overrides };
}

// ── Traceability ────────────────────────────────────────────────────

describe("buildTraceabilityMatrix", () => {
	it("builds matrix with linked and unlinked items", () => {
		const components = [
			makeComp({ name: "A", requirements: ["REQ-001"] }),
			makeComp({ name: "B" }),
		];
		const requirements = [makeReq({ id: "REQ-001", name: "R1" }), makeReq({ id: "REQ-002", name: "R2" })];

		const matrix = buildTraceabilityMatrix(components, requirements);

		expect(matrix.rows).toHaveLength(2);
		expect(matrix.linkedRequirements).toBe(1);
		expect(matrix.unlinkedRequirements).toBe(1);
		expect(matrix.unlinkedComponents).toBe(1);
	});

	it("handles empty inputs", () => {
		const matrix = buildTraceabilityMatrix([], []);
		expect(matrix.rows).toHaveLength(0);
		expect(matrix.linkedRequirements).toBe(0);
	});
});

describe("findUnlinkedRequirements", () => {
	it("returns requirements not linked to any component", () => {
		const components = [makeComp({ requirements: ["REQ-001"] })];
		const requirements = [makeReq({ id: "REQ-001" }), makeReq({ id: "REQ-002" })];

		const unlinked = findUnlinkedRequirements(components, requirements);
		expect(unlinked).toHaveLength(1);
		expect(unlinked[0].id).toBe("REQ-002");
	});
});

describe("findUnlinkedComponents", () => {
	it("returns components with no requirements", () => {
		const components = [
			makeComp({ name: "A", requirements: ["REQ-001"] }),
			makeComp({ name: "B" }),
		];
		const unlinked = findUnlinkedComponents(components);
		expect(unlinked).toHaveLength(1);
		expect(unlinked[0].name).toBe("B");
	});
});

// ── Product views ───────────────────────────────────────────────────

describe("buildProductViews", () => {
	it("groups features under products", () => {
		const components = [
			makeComp({ name: "MyApp", role: "product", kind: "system" }),
			makeComp({ name: "Auth", role: "feature", containedBy: "MyApp", priority: "must", status: "active" }),
			makeComp({ name: "UI", role: "feature", containedBy: "MyApp", priority: "should", status: "draft" }),
		];

		const views = buildProductViews(components);

		expect(views).toHaveLength(1);
		expect(views[0].product.name).toBe("MyApp");
		expect(views[0].features).toHaveLength(2);
		expect(views[0].featuresByPriority.must).toHaveLength(1);
		expect(views[0].completionRate).toBe(50);
	});

	it("returns empty for no products", () => {
		const views = buildProductViews([makeComp()]);
		expect(views).toHaveLength(0);
	});
});

describe("buildFeatureList", () => {
	it("filters by priority", () => {
		const components = [
			makeComp({ name: "A", role: "feature", priority: "must" }),
			makeComp({ name: "B", role: "feature", priority: "could" }),
		];
		const musts = buildFeatureList(components, { priority: "must" });
		expect(musts).toHaveLength(1);
		expect(musts[0].name).toBe("A");
	});

	it("filters by status", () => {
		const components = [
			makeComp({ name: "A", role: "feature", status: "active" }),
			makeComp({ name: "B", role: "feature", status: "draft" }),
		];
		const active = buildFeatureList(components, { status: "active" });
		expect(active).toHaveLength(1);
	});
});

// ── Arc42 ───────────────────────────────────────────────────────────

describe("c4ToArc42Level", () => {
	it("maps system to context", () => { expect(c4ToArc42Level("system")).toBe("context"); });
	it("maps container to container", () => { expect(c4ToArc42Level("container")).toBe("container"); });
	it("maps c4-component to component", () => { expect(c4ToArc42Level("c4-component")).toBe("component"); });
	it("returns undefined for unmapped kinds", () => { expect(c4ToArc42Level("page")).toBeUndefined(); });
});

describe("buildArc42View", () => {
	it("separates components by arc42 level", () => {
		const components = [
			makeComp({ name: "Platform", kind: "system" }),
			makeComp({ name: "WebApp", kind: "container", containedBy: "Platform" }),
			makeComp({ name: "AuthModule", kind: "c4-component", containedBy: "WebApp" }),
			makeComp({ name: "Button", kind: "ui-component" }),
		];

		const view = buildArc42View(components);

		expect(view.context).toHaveLength(1);
		expect(view.containers.get("Platform")).toHaveLength(1);
		expect(view.components.get("WebApp")).toHaveLength(1);
	});

	it("collects relationships", () => {
		const components = [
			makeComp({
				name: "WebApp", kind: "container",
				relationships: [{ target: "DB", type: "uses", technology: "REST" }],
			}),
		];

		const view = buildArc42View(components);

		expect(view.relationships).toHaveLength(1);
		expect(view.relationships[0].from).toBe("WebApp");
		expect(view.relationships[0].technology).toBe("REST");
	});

	it("handles empty components", () => {
		const view = buildArc42View([]);
		expect(view.context).toHaveLength(0);
		expect(view.relationships).toHaveLength(0);
	});
});
