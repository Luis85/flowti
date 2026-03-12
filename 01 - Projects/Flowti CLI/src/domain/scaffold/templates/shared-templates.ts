/**
 * shared-templates.ts — Config file templates for scaffolded Flowti projects.
 *
 * These mirror the CLI's own stack: TypeScript strict, Vitest, esbuild, ESLint.
 * All templates are pure functions conforming to TemplateFn.
 */

import type { TemplateFn, ScaffoldVariables, ScaffoldDefinition } from "../scaffold-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function toJson(obj: unknown): string {
	return JSON.stringify(obj, null, "\t") + "\n";
}

// ── package.json ─────────────────────────────────────────────────────

export const packageJsonTemplate: TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition): string => {
	return toJson({
		name: vars.id,
		version: "0.0.1",
		...def.package.type ? { type: def.package.type } : {},
		description: vars.name,
		private: true,
		scripts: def.package.scripts,
		devDependencies: def.package.devDependencies,
	});
};

// ── tsconfig.json ────────────────────────────────────────────────────

export const tsconfigTemplate: TemplateFn = (): string => {
	return toJson({
		compilerOptions: {
			target: "ES2022",
			module: "NodeNext",
			moduleResolution: "NodeNext",
			strict: true,
			esModuleInterop: true,
			outDir: "../dist",
			rootDir: "..",
			declaration: true,
			sourceMap: true,
			skipLibCheck: true,
		},
		include: ["../src/**/*.ts"],
		exclude: ["../node_modules", "../dist", "../tests"],
	});
};

// ── vitest.config.ts ─────────────────────────────────────────────────

export const vitestConfigTemplate: TemplateFn = (): string => {
	return `import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
\ttest: {
\t\troot: path.resolve(import.meta.dirname, ".."),
\t\tinclude: ["tests/**/*.test.ts"],
\t\tcoverage: {
\t\t\tprovider: "v8",
\t\t\treporter: ["text", "json-summary"],
\t\t\tinclude: ["src/**/*.ts"],
\t\t},
\t},
});
`;
};

// ── esbuild.config.mjs ──────────────────────────────────────────────

export const esbuildConfigTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `/**
 * esbuild.config.mjs — Bundles ${vars.name} into dist/main.js.
 */

import esbuild from "esbuild";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outDir = path.join(projectRoot, "dist");
const isWatch = process.argv.includes("--watch");

const options = {
\tentryPoints: [path.join(projectRoot, "src/main.ts")],
\tbundle: true,
\toutfile: path.join(outDir, "main.js"),
\tplatform: "node",
\tformat: "esm",
\ttarget: "node22",
\tsourcemap: !isWatch,
\tminify: !isWatch,
\tbanner: { js: "#!/usr/bin/env node" },
\texternal: ["node:*"],
};

if (isWatch) {
\tconst ctx = await esbuild.context(options);
\tawait ctx.watch();
\tconsole.log("  Watching for changes...");
} else {
\tawait esbuild.build(options);
\tconsole.log(\`  Built: dist/main.js\`);
}
`;
};

// ── eslint.config.mjs ────────────────────────────────────────────────

export const eslintConfigTemplate: TemplateFn = (): string => {
	return `import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
\t...tseslint.configs["flat/recommended"].map((config) => ({
\t\t...config,
\t\tfiles: ["src/**/*.ts"],
\t})),
\t{
\t\tfiles: ["src/**/*.ts"],
\t\tlanguageOptions: {
\t\t\tparser: tsparser,
\t\t\tparserOptions: { ecmaVersion: "latest", sourceType: "module" },
\t\t},
\t\tplugins: { "@typescript-eslint": tseslint },
\t\trules: {
\t\t\tcomplexity: ["warn", 10],
\t\t\t"max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
\t\t\t"no-unused-vars": "off",
\t\t\t"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
\t\t\t"@typescript-eslint/ban-ts-comment": "off",
\t\t\t"@typescript-eslint/no-empty-function": "off",
\t\t},
\t},
];
`;
};

// ── .gitignore ───────────────────────────────────────────────────────

export const gitignoreTemplate: TemplateFn = (): string => {
	return `node_modules/
dist/
*.js.map
`;
};

// ── flowti.config.json ───────────────────────────────────────────────

export const flowtiConfigTemplate: TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition): string => {
	return toJson({
		name: vars.id,
		...def.flowtiConfig,
	});
};

// ── README.md ──────────────────────────────────────────────────────────

export const readmeTemplate: TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition): string => {
	const lines: string[] = [
		`# ${vars.name}`,
		"",
		def.description,
		"",
		"## Project Brief",
		"",
		`> Fill in this section to define the project's scope and goals.`,
		`> See [[${vars.name} — Architecture]] for the technical design.`,
		"",
		"### Vision",
		"",
		"_What problem does this project solve? Who is it for?_",
		"",
		"### Goals",
		"",
		"- [ ] Goal 1",
		"- [ ] Goal 2",
		"- [ ] Goal 3",
		"",
		"### Non-Goals",
		"",
		"- _What is explicitly out of scope?_",
		"",
		"### Key Decisions",
		"",
		`| Decision | Rationale | Date |`,
		`|----------|-----------|------|`,
		`| _e.g., Use TypeScript strict_ | _Type safety from day one_ | _${new Date().toISOString().slice(0, 10)}_ |`,
		"",
	];

	// Commands section from package.json scripts
	const scripts = def.package.scripts;
	if (Object.keys(scripts).length > 0) {
		lines.push("## Commands", "");
		lines.push("| Command | Description |");
		lines.push("|---------|-------------|");
		for (const [name, cmd] of Object.entries(scripts)) {
			lines.push(`| \`npm run ${name}\` | \`${cmd}\` |`);
		}
		lines.push("");
	}

	// Dev tools section
	const devDeps = Object.keys(def.package.devDependencies);
	if (devDeps.length > 0) {
		lines.push("## Dev Tools", "");
		for (const dep of devDeps) {
			lines.push(`- ${dep}`);
		}
		lines.push("");
	}

	// Getting started
	lines.push(
		"## Getting Started",
		"",
		"```bash",
		...def.nextSteps,
		"```",
		"",
		"## Documentation",
		"",
		`- [[${vars.name} — Architecture]] — Technical architecture (arc42 + C4)`,
		`- [[configs/flowti.config.json]] — CLI configuration`,
		`- [[configs/tsconfig.json]] — TypeScript configuration`,
		"",
		"---",
		"",
		`*Managed by [Flowti CLI](https://github.com/flowti/flowti-cli)*`,
		"",
	);

	return lines.join("\n");
};

// ── Architecture Document (arc42 + C4) ──────────────────────────────

export const architectureTemplate: TemplateFn = (vars: ScaffoldVariables): string => {
	return `# ${vars.name} — Architecture

> Technical architecture following [arc42](https://arc42.org/) and [C4 model](https://c4model.com/) conventions.
> See [[README]] for the project brief.

## 1. Introduction & Goals

### Requirements Overview

_Key functional requirements driving the architecture._

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | _e.g., Process input and produce output_ | Must |

### Quality Goals

| Priority | Quality | Motivation |
|----------|---------|------------|
| 1 | Testability | Every module is unit-testable in isolation |
| 2 | Maintainability | Clear boundaries, no circular dependencies |
| 3 | Performance | _Define acceptable thresholds_ |

### Stakeholders

| Role | Expectations |
|------|-------------|
| Developer | Clean APIs, fast feedback loop |
| User | Reliable, well-documented |

## 2. Constraints

- TypeScript strict mode
- ESM modules (\`"type": "module"\`)
- Node.js >= 22

## 3. Context & Scope (C4 Level 1 — System Context)

\`\`\`
┌─────────────────────────────┐
│     ${vars.name.padEnd(24)}│
│         (this system)       │
└──────┬──────────────┬───────┘
       │              │
  [User/CLI]    [External Systems]
\`\`\`

### External Interfaces

| Interface | Direction | Description |
|-----------|-----------|-------------|
| CLI | In | User commands via terminal |
| File System | In/Out | Read/write project files |

## 4. Solution Strategy

_High-level approach to meeting the quality goals._

- **Domain-Driven Design**: Business logic in \`[[src/]]\`, infrastructure adapters separate
- **Dependency Injection**: All I/O via \`deps\` parameter, no singletons in domain
- **Pure Functions**: Domain functions return data, no side effects

## 5. Building Block View (C4 Level 2 — Container)

### Level 1: Top-Level Decomposition

\`\`\`
[[src/]]
├── domain/        # Business logic (pure functions)
├── infrastructure/ # I/O adapters (filesystem, shell, clock)
└── main.ts        # Entry point, composition root
\`\`\`

### Level 2: Domain Modules

_Add domain modules as the project grows._

| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| _core_ | _Main business logic_ | \`[[src/main.ts]]\` |

## 6. Runtime View

### Key Scenarios

#### Scenario 1: _[Name]_

\`\`\`
User → main.ts → domain/[module] → result
\`\`\`

## 7. Deployment View

- **Build**: \`npm run build\` → \`dist/\`
- **Test**: \`npm test\` (lint + type-check + vitest)
- **Config**: \`[[configs/flowti.config.json]]\`

## 8. Crosscutting Concepts

### Error Handling

_How errors propagate through the system._

### Testing Strategy

| Level | Tool | Location |
|-------|------|----------|
| Unit | Vitest | \`[[tests/]]\` |
| Integration | _TBD_ | — |
| E2E | _TBD_ | — |

## 9. Architecture Decisions

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-001 | _e.g., Use ESM over CJS_ | Accepted |

## 10. Quality Requirements

### Quality Tree

\`\`\`
Quality
├── Testability
│   ├── Unit test coverage > 80%
│   └── No mocking of domain logic
├── Maintainability
│   ├── No circular dependencies
│   └── Max file complexity: 20
└── Performance
    └── Build time < 5s
\`\`\`

## 11. Risks & Technical Debt

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| _e.g., Scope creep_ | Medium | High | Strict non-goals in [[README]] |

## 12. Glossary

| Term | Definition |
|------|-----------|
| _Domain_ | _Business logic, free of I/O_ |
| _Infrastructure_ | _Adapters for external systems_ |

---

*Managed by [Flowti CLI](https://github.com/flowti/flowti-cli)*
`;
};

// ── Export all ────────────────────────────────────────────────────────

export const sharedTemplates: Record<string, TemplateFn> = {
	"package-json": packageJsonTemplate,
	"tsconfig": tsconfigTemplate,
	"vitest-config": vitestConfigTemplate,
	"esbuild-config": esbuildConfigTemplate,
	"eslint-config": eslintConfigTemplate,
	"gitignore": gitignoreTemplate,
	"flowti-config": flowtiConfigTemplate,
	"readme": readmeTemplate,
	"architecture": architectureTemplate,
};
