import type { CliDeps } from "./deps.js";
import type { IClock } from "./types.js";
import { parseFrontmatterStrings } from "./frontmatter.js";
import { listMdFiles, resolveDir, toMdFilename, updateField } from "./markdown-utils.js";

// ── Types ────────────────────────────────────────────────────────

export type StoreDeps = Pick<CliDeps, "disk" | "paths"> & { clock?: IClock };

export interface FieldSpec {
	type: "string" | "number" | "boolean" | "enum" | "array" | "date";
	default?: unknown;
	options?: string[];
	required?: boolean;
	from?: "frontmatter" | "filename" | "dirname";
	parse?: (raw: string) => unknown;
	serialize?: (value: unknown) => string;
}

export interface CompanionSpec {
	extension: string;
	fields: string[];
}

export interface StoreDescriptor<TSummary, TDefinition> {
	name: string;
	defaultDir: string;
	configPath?: string;
	fields: Record<string, FieldSpec>;
	typeTag: string;
	filename?: (def: TDefinition, deps: StoreDeps) => string;
	sort?: (a: TSummary, b: TSummary) => number;
	filter?: (fm: Record<string, string>) => boolean;
	buildBody: (def: TDefinition, deps: StoreDeps) => string;
	parseBody?: (body: string, fm: Record<string, string>) => Partial<TSummary>;
	needsClock?: boolean;
	companion?: CompanionSpec;
	idGeneration?: { prefix: string; padding: number };
	nested?: boolean;
}

export interface StoreApi<TSummary, TDefinition> {
	list: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => TSummary[];
	read: (deps: StoreDeps, projectPath: string, name: string, config?: Record<string, unknown>) => TSummary | undefined;
	create: (deps: StoreDeps, projectPath: string, def: TDefinition, config?: Record<string, unknown>) => string;
	updateField: (deps: StoreDeps, projectPath: string, name: string, field: string, value: string, config?: Record<string, unknown>) => boolean;
	remove: (deps: StoreDeps, projectPath: string, name: string, config?: Record<string, unknown>) => void;
	resolveDir: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => string;
	nextId?: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => string;
	__descriptor: StoreDescriptor<TSummary, TDefinition>;
}

// ── Engine ───────────────────────────────────────────────────────

const fieldParsers: Record<string, (raw: string, spec: FieldSpec) => unknown> = {
	number: (raw, spec) => parseFloat(raw) || (spec.default ?? 0),
	boolean: (raw) => raw === "true",
	enum: (raw, spec) => spec.options?.includes(raw) ? raw : (spec.default ?? raw),
	array: (raw) => raw.split(",").map(s => s.trim()).filter(Boolean),
};

function parseFieldValue(raw: string | undefined, spec: FieldSpec): unknown {
	if (raw === undefined) return spec.default;
	if (spec.parse) return spec.parse(raw);
	return fieldParsers[spec.type]?.(raw, spec) ?? raw;
}

function serializeFieldValue(value: unknown, spec: FieldSpec): string {
	if (spec.serialize) return spec.serialize(value);
	if (Array.isArray(value)) return value.join(", ");
	return String(value ?? "");
}

function writeCompanion<TDefinition>(
	deps: StoreDeps,
	desc: Pick<StoreDescriptor<unknown, TDefinition>, "companion">,
	def: TDefinition,
	filePath: string,
): void {
	if (!desc.companion) return;
	const companionData: Record<string, unknown> = {};
	for (const field of desc.companion.fields) {
		if ((def as Record<string, unknown>)[field] !== undefined) {
			companionData[field] = (def as Record<string, unknown>)[field];
		}
	}
	if (Object.keys(companionData).length > 0) {
		const companionPath = filePath.replace(/\.md$/, desc.companion.extension);
		deps.disk.writeFileSync(companionPath, JSON.stringify(companionData, null, "\t"), "utf-8");
	}
}

export function createStore<TSummary, TDefinition>(
	desc: StoreDescriptor<TSummary, TDefinition>,
): StoreApi<TSummary, TDefinition> {
	function getDir(deps: StoreDeps, projectPath: string, config?: Record<string, unknown>): string {
		const configDir = config && desc.configPath ? (config as Record<string, unknown>)[desc.configPath] as string | undefined : undefined;
		return resolveDir(deps, projectPath, configDir, desc.defaultDir);
	}

	function parseSummary(fm: Record<string, string>, file: string): TSummary {
		const obj: Record<string, unknown> = {};
		for (const [key, spec] of Object.entries(desc.fields)) {
			const source = spec.from === "filename" ? file.replace(/\.md$/, "") : fm[key];
			obj[key] = parseFieldValue(source, spec);
		}
		obj.file = file;
		return obj as TSummary;
	}

	const store: StoreApi<TSummary, TDefinition> = {
		list(deps, projectPath, config?) {
			const dir = getDir(deps, projectPath, config);
			const files = listMdFiles(deps, dir);
			const items: TSummary[] = [];
			for (const file of files) {
				const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
				const fm = parseFrontmatterStrings(content);
				if (desc.filter && !desc.filter(fm)) continue;
				const item = parseSummary(fm, file);
				if (desc.parseBody) {
					const bodyMatch = content.match(/^---[\s\S]*?---\s*([\s\S]*)/);
					if (bodyMatch) Object.assign(item as Record<string, unknown>, desc.parseBody(bodyMatch[1], fm));
				}
				items.push(item);
			}
			if (desc.sort) items.sort(desc.sort);
			return items;
		},

		read(deps, projectPath, name, config?) {
			const dir = getDir(deps, projectPath, config);
			const filename = toMdFilename(name);
			const filePath = deps.paths.join(dir, filename);
			if (!deps.disk.existsSync(filePath)) return undefined;
			const content = deps.disk.readFileSync(filePath, "utf-8");
			const fm = parseFrontmatterStrings(content);
			return parseSummary(fm, filename);
		},

		create(deps, projectPath, def, config?) {
			const dir = getDir(deps, projectPath, config);
			deps.disk.mkdirSync(dir, { recursive: true });
			const filename = desc.filename
				? desc.filename(def, deps)
				: toMdFilename((def as Record<string, unknown>).name as string ?? "untitled");
			const filePath = deps.paths.join(dir, filename);

			// Build frontmatter
			const fm: Record<string, string> = { type: desc.typeTag };
			for (const [key, spec] of Object.entries(desc.fields)) {
				const val = (def as Record<string, unknown>)[key];
				if (val !== undefined) {
					fm[key] = serializeFieldValue(val, spec);
				} else if (spec.default !== undefined) {
					fm[key] = serializeFieldValue(spec.default, spec);
				}
			}
			if (deps.clock) fm.date = deps.clock.iso();

			const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
			const body = desc.buildBody(def, deps);
			const content = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;

			deps.disk.writeFileSync(filePath, content, "utf-8");
			writeCompanion(deps, desc, def, filePath);

			return filePath;
		},

		updateField(deps, projectPath, name, field, value, config?) {
			const dir = getDir(deps, projectPath, config);
			const filePath = deps.paths.join(dir, toMdFilename(name));
			return updateField(deps, filePath, field, value);
		},

		remove(deps, projectPath, name, config?) {
			const dir = getDir(deps, projectPath, config);
			const filePath = deps.paths.join(dir, toMdFilename(name));
			if (deps.disk.existsSync(filePath)) {
				deps.disk.unlinkSync(filePath);
			}
		},

		resolveDir: getDir,

		__descriptor: desc,
	};

	// Add ID generation if configured
	if (desc.idGeneration) {
		store.nextId = (deps, projectPath, config?) => {
			const items = store.list(deps, projectPath, config);
			const { prefix, padding } = desc.idGeneration!;
			const pattern = new RegExp(`^${prefix}-(\\d+)$`);
			let max = 0;
			for (const item of items) {
				const id = (item as Record<string, unknown>).id;
				if (typeof id === "string") {
					const m = id.match(pattern);
					if (m) max = Math.max(max, parseInt(m[1], 10));
				}
			}
			return `${prefix}-${String(max + 1).padStart(padding, "0")}`;
		};
	}

	return store;
}
