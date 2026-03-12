import { describe, it, expect } from "vitest";
import { componentDocTemplate } from "../../../../src/domain/make/component/templates/component-doc.js";
import { c4DocTemplate } from "../../../../src/domain/make/component/templates/c4-doc.js";
import { componentTestTemplate } from "../../../../src/domain/make/component/templates/component-test.js";
import { componentDefinitionTemplate } from "../../../../src/domain/make/component/templates/component-definition.js";
import { componentStoryTemplate } from "../../../../src/domain/make/component/templates/component-story.js";
import type { ComponentVariables, ComponentDefinition, ComponentTemplateDeps } from "../../../../src/domain/make/component/component-types.js";

const mockDeps: ComponentTemplateDeps = {
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
};

function vars(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
	return { name: "Auth Service", kebab: "auth-service", pascal: "AuthService", camel: "authService", ...overrides };
}

function def(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
	return {
		id: "component", kind: "component", label: "Component", description: "Test.",
		prompts: [], files: [], metadata: { type: "component", status: "draft" },
		properties: [], actions: [], variants: [], states: [], nextSteps: [],
		...overrides,
	};
}

describe("componentDocTemplate", () => {
	it("returns a Document with valid YAML frontmatter", () => {
		const doc = componentDocTemplate(vars(), def(), mockDeps);
		const output = doc.toString();
		expect(output).toMatch(/^---\n/);
		expect(output).toContain("type: component");
		expect(output).toContain("status: draft");
		expect(output).toContain("created:");
	});

	it("includes the component name as heading", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).toContain("# Auth Service");
	});

	it("includes description when provided", () => {
		const output = componentDocTemplate(vars({ description: "Handles authentication." }), def(), mockDeps).toString();
		expect(output).toContain("Handles authentication.");
	});

	it("includes owner when provided", () => {
		const output = componentDocTemplate(vars({ owner: "Platform Team" }), def(), mockDeps).toString();
		expect(output).toContain("owner: Platform Team");
	});

	it("supports toLines() output", () => {
		const lines = componentDocTemplate(vars(), def(), mockDeps).toLines();
		expect(Array.isArray(lines)).toBe(true);
		expect(lines[0]).toBe("---");
		expect(lines).toContain("# Auth Service");
	});
});

describe("c4DocTemplate", () => {
	it("returns a Document for C4 System with boundaries section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "system", metadata: { type: "system", c4Level: 1 } }), mockDeps).toString();
		expect(output).toContain("c4: System");
		expect(output).toContain("c4Level: 1");
		expect(output).toContain("## Boundaries");
		expect(output).toContain("## Containers");
	});

	it("generates C4 Container doc with components section", () => {
		const output = c4DocTemplate(
			vars({ technology: "Node.js", containedBy: "payment-system" }),
			def({ kind: "container", metadata: { type: "container", c4Level: 2 } }),
			mockDeps,
		).toString();
		expect(output).toContain("c4: Container");
		expect(output).toContain("technology: Node.js");
		expect(output).toContain("containedBy: payment-system");
		expect(output).toContain("## Components");
	});

	it("generates C4 Component doc with responsibilities section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "c4-component", metadata: { type: "c4-component", c4Level: 3 } }), mockDeps).toString();
		expect(output).toContain("c4: Component");
		expect(output).toContain("## Responsibilities");
	});

	it("generates C4 Person doc with role section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "person", metadata: { type: "person", c4Level: 0 } }), mockDeps).toString();
		expect(output).toContain("c4: Person");
		expect(output).toContain("## Role");
		expect(output).toContain("## Interactions");
	});

	it("supports toLines() output", () => {
		const lines = c4DocTemplate(vars(), def({ kind: "system", metadata: { type: "system", c4Level: 1 } }), mockDeps).toLines();
		expect(Array.isArray(lines)).toBe(true);
		expect(lines[0]).toBe("---");
	});
});

describe("componentTestTemplate", () => {
	it("generates a valid test file", () => {
		const output = componentTestTemplate(vars(), def(), mockDeps);
		expect(output).toContain('describe("Auth Service"');
		expect(output).toContain("import(");
		expect(output).toContain("auth-service/auth-service.json");
	});
});

describe("componentDefinitionTemplate", () => {
	it("generates valid JSON with name and id", () => {
		const output = componentDefinitionTemplate(vars(), def(), mockDeps);
		const parsed = JSON.parse(output);
		expect(parsed.name).toBe("Auth Service");
		expect(parsed.id).toBe("auth-service");
		expect(parsed.type).toBe("component");
		expect(parsed.status).toBe("draft");
	});

	it("includes extra variables when provided", () => {
		const output = componentDefinitionTemplate(
			vars({ description: "Authenticates users", technology: "JWT", owner: "Security" }),
			def({ metadata: { type: "c4-component", c4Level: 3 } }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.description).toBe("Authenticates users");
		expect(parsed.technology).toBe("JWT");
		expect(parsed.owner).toBe("Security");
	});

	it("includes properties with defaults when definition has properties", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({
				properties: [
					{ key: "direction", type: "string", default: "vertical" },
					{ key: "gap", type: "string", default: "0" },
					{ key: "visible", type: "boolean", default: true },
				],
			}),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.properties).toEqual({ direction: "vertical", gap: "0", visible: true });
	});

	it("omits properties when definition has no properties", () => {
		const output = componentDefinitionTemplate(vars(), def(), mockDeps);
		const parsed = JSON.parse(output);
		expect(parsed.properties).toBeUndefined();
	});
});

describe("componentDocTemplate — properties table", () => {
	it("renders a Properties table when definition has properties", () => {
		const output = componentDocTemplate(
			vars(),
			def({
				properties: [
					{ key: "direction", type: "string", default: "vertical", description: "Layout direction" },
					{ key: "gap", type: "string", default: "0", description: "Spacing" },
				],
			}),
			mockDeps,
		).toString();
		expect(output).toContain("## Properties");
		expect(output).toContain("| direction | string | vertical | Layout direction |");
		expect(output).toContain("| gap | string | 0 | Spacing |");
	});

	it("omits Properties section when definition has no properties", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("## Properties");
	});
});

describe("componentStoryTemplate", () => {
	it("generates a Storybook story with autodocs tag and render function", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).toContain('tags: ["autodocs"]');
		expect(output).toContain("render: (args) => {");
		expect(output).toContain('el.className = "auth-service"');
		expect(output).toContain("export const Default: Story = {};");
	});

	it("uses Components folder for ui-component kind", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).toContain('title: "Components/AuthService"');
	});

	it("uses Layouts folder for layout kind", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "layout" }), mockDeps);
		expect(output).toContain('title: "Layouts/AuthService"');
	});

	it("uses Pages folder for page kind", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "page" }), mockDeps);
		expect(output).toContain('title: "Pages/AuthService"');
	});

	it("includes argTypes and args when definition has properties", () => {
		const output = componentStoryTemplate(
			vars(),
			def({
				kind: "ui-component",
				properties: [
					{ key: "variant", type: "string", default: "default", description: "Visual variant" },
					{ key: "disabled", type: "boolean", default: false, description: "Whether disabled" },
				],
			}),
			mockDeps,
		);
		expect(output).toContain("argTypes:");
		expect(output).toContain('variant: { control: "text", description: "Visual variant" }');
		expect(output).toContain('disabled: { control: "boolean", description: "Whether disabled" }');
		expect(output).toContain("args:");
		expect(output).toContain('variant: "default"');
		expect(output).toContain("disabled: false");
	});

	it("omits argTypes and args when no properties", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).not.toContain("argTypes:");
		expect(output).not.toMatch(/^\targs:/m);
	});

	it("includes action imports and argTypes for actions", () => {
		const output = componentStoryTemplate(
			vars(),
			def({
				kind: "ui-component",
				actions: [
					{ name: "onClick", description: "Clicked" },
					{ name: "onFocus" },
				],
			}),
			mockDeps,
		);
		expect(output).toContain('import { action } from "storybook/actions"');
		expect(output).toContain('onClick: { action: "onClick", description: "Clicked" }');
		expect(output).toContain('onFocus: { action: "onFocus" }');
		expect(output).toContain('onClick: action("onClick")');
		expect(output).toContain('onFocus: action("onFocus")');
	});

	it("does not import actions addon when no actions defined", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).not.toContain("storybook/actions");
	});

	it("generates named story exports for variants", () => {
		const output = componentStoryTemplate(
			vars(),
			def({
				kind: "ui-component",
				variants: [
					{ name: "primary", label: "Primary", props: { variant: "primary" } },
					{ name: "secondary", label: "Secondary", props: { variant: "secondary" } },
				],
			}),
			mockDeps,
		);
		expect(output).toContain("export const Primary: Story = {");
		expect(output).toContain('variant: "primary"');
		expect(output).toContain("export const Secondary: Story = {");
		expect(output).toContain('variant: "secondary"');
	});

	it("generates named story exports for states", () => {
		const output = componentStoryTemplate(
			vars(),
			def({
				kind: "ui-component",
				states: [
					{ name: "loading", label: "Loading", description: "Content loading", props: { title: "Loading..." } },
					{ name: "disabled", label: "Disabled", props: { disabled: true } },
				],
			}),
			mockDeps,
		);
		expect(output).toContain("export const Loading: Story = {");
		expect(output).toContain('title: "Loading..."');
		expect(output).toContain("export const Disabled: Story = {");
		expect(output).toContain("disabled: true");
	});

	it("combines properties, actions, variants and states in one story", () => {
		const output = componentStoryTemplate(
			vars(),
			def({
				kind: "ui-component",
				properties: [{ key: "visible", type: "boolean", default: true }],
				actions: [{ name: "onClick" }],
				variants: [{ name: "primary", props: { visible: true } }],
				states: [{ name: "hidden", props: { visible: false } }],
			}),
			mockDeps,
		);
		expect(output).toContain("argTypes:");
		expect(output).toContain('visible: { control: "boolean" }');
		expect(output).toContain('onClick: { action: "onClick" }');
		expect(output).toContain("export const Primary: Story = {");
		expect(output).toContain("export const Hidden: Story = {");
	});
});

describe("componentDocTemplate — actions, variants, states tables", () => {
	it("renders Actions table when definition has actions", () => {
		const output = componentDocTemplate(
			vars(),
			def({ actions: [{ name: "onClick", description: "Clicked" }] }),
			mockDeps,
		).toString();
		expect(output).toContain("## Actions");
		expect(output).toContain("| onClick | Clicked |");
	});

	it("omits Actions section when no actions", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("## Actions");
	});

	it("renders Variants table when definition has variants", () => {
		const output = componentDocTemplate(
			vars(),
			def({ variants: [{ name: "primary", label: "Primary", props: { variant: "primary" } }] }),
			mockDeps,
		).toString();
		expect(output).toContain("## Variants");
		expect(output).toContain("primary");
	});

	it("omits Variants section when no variants", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("## Variants");
	});

	it("renders States table when definition has states", () => {
		const output = componentDocTemplate(
			vars(),
			def({ states: [{ name: "loading", label: "Loading", description: "Loading state", props: { title: "..." } }] }),
			mockDeps,
		).toString();
		expect(output).toContain("## States");
		expect(output).toContain("loading");
	});

	it("omits States section when no states", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("## States");
	});
});

describe("componentDefinitionTemplate — actions, variants, states", () => {
	it("includes actions list in JSON when actions defined", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({ actions: [{ name: "onClick" }, { name: "onFocus" }] }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.actions).toEqual(["onClick", "onFocus"]);
	});

	it("omits actions from JSON when no actions", () => {
		const output = componentDefinitionTemplate(vars(), def(), mockDeps);
		const parsed = JSON.parse(output);
		expect(parsed.actions).toBeUndefined();
	});

	it("includes variants map in JSON when variants defined", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({ variants: [{ name: "primary", props: { variant: "primary" } }] }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.variants).toEqual({ primary: { variant: "primary" } });
	});

	it("includes states map in JSON when states defined", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({ states: [{ name: "loading", props: { title: "..." } }] }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.states).toEqual({ loading: { title: "..." } });
	});

	it("includes domain, icon, heroImage in JSON when defined", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({ domain: "auth", icon: "lock", heroImage: "hero.png" }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.domain).toBe("auth");
		expect(parsed.icon).toBe("lock");
		expect(parsed.heroImage).toBe("hero.png");
	});

	it("includes images array in JSON when defined", () => {
		const output = componentDefinitionTemplate(
			vars(),
			def({ images: [{ src: "screenshot.png", alt: "Screenshot", role: "screenshot" }] }),
			mockDeps,
		);
		const parsed = JSON.parse(output);
		expect(parsed.images).toEqual([{ src: "screenshot.png", alt: "Screenshot", role: "screenshot" }]);
	});

	it("omits domain/icon/heroImage/images when not defined", () => {
		const output = componentDefinitionTemplate(vars(), def(), mockDeps);
		const parsed = JSON.parse(output);
		expect(parsed.domain).toBeUndefined();
		expect(parsed.icon).toBeUndefined();
		expect(parsed.heroImage).toBeUndefined();
		expect(parsed.images).toBeUndefined();
	});
});

describe("componentDocTemplate — icon, domain, heroImage, images", () => {
	it("includes domain and icon in frontmatter", () => {
		const output = componentDocTemplate(vars(), def({ domain: "checkout", icon: "cart" }), mockDeps).toString();
		expect(output).toContain("domain: checkout");
		expect(output).toContain("icon: cart");
	});

	it("omits domain and icon when not defined", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("domain:");
		expect(output).not.toContain("icon:");
	});

	it("renders Images section with hero image", () => {
		const output = componentDocTemplate(vars(), def({ heroImage: "hero.png" }), mockDeps).toString();
		expect(output).toContain("## Images");
		expect(output).toContain("![Hero](hero.png)");
	});

	it("renders Images section with gallery images", () => {
		const output = componentDocTemplate(
			vars(),
			def({ images: [
				{ src: "a.png", alt: "Screenshot A", role: "screenshot" },
				{ src: "b.png", role: "mockup" },
			] }),
			mockDeps,
		).toString();
		expect(output).toContain("## Images");
		expect(output).toContain("![Screenshot A](a.png)");
		expect(output).toContain("![[mockup]](b.png)");
	});

	it("omits Images section when no heroImage and no images", () => {
		const output = componentDocTemplate(vars(), def(), mockDeps).toString();
		expect(output).not.toContain("## Images");
	});
});

describe("componentStoryTemplate — parameters block", () => {
	it("includes icon, domain and heroImage in parameters", () => {
		const output = componentStoryTemplate(
			vars(),
			def({ kind: "ui-component", icon: "lock", heroImage: "hero.png", domain: "auth" }),
			mockDeps,
		);
		expect(output).toContain("parameters:");
		expect(output).toContain('icon: "lock"');
		expect(output).toContain('heroImage: "hero.png"');
		expect(output).toContain('domain: "auth"');
	});

	it("always includes docs description from markdown import", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).toContain("parameters:");
		expect(output).toContain("docs: { description: { component: componentDoc } }");
	});

	it("imports the component markdown file as raw string", () => {
		const output = componentStoryTemplate(vars(), def({ kind: "ui-component" }), mockDeps);
		expect(output).toContain('import componentDoc from "../../../docs/components/auth-service.md?raw"');
	});
});
