/**
 * Vault-based project service — scans 01 - Projects/ via Obsidian Vault API.
 * Works fully offline. Storybook operations run as local async shell commands.
 */

import type { App, TFolder, TFile } from "obsidian";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IProjectService, ProjectSummary, ProjectDetail, StorybookFramework, OutputCallback, MarkdownSourceConfig, TodoItem, CatalogEntity, CatalogEntityType, CatalogEntityDef, ReportGeneratorInfo, ComponentEntry, HealthScore, TeamRoleSlot, VaultAgentSummary } from "../../domain/projects/types.js";
import { reconcileProjectRoster } from "../../domain/projects/team-roster.js";
import { normalizeTeamRoleSlots } from "../../domain/projects/team-roster-normalize.js";
import { buildAgentMarkdownFile, buildAgentCompanionJson, agentVaultPaths } from "../../domain/projects/agent-note-builder.js";
import { listVaultAgentSummaries } from "../../domain/projects/agent-vault-scan.js";
import { parseTodos, addTodoLine, toggleTodoLine, deleteTodoLine } from "../../domain/projects/todo-service.js";
import { parseEntityFromMarkdown, generateDomainMarkdown, generateServiceMarkdown, generateEventMarkdown, generateFlowMarkdown, toKebabCase } from "../../domain/projects/catalog-service.js";
import { parseFrontmatter } from "../../domain/projects/frontmatter.js";
import { resolveNoteInfoAsync, readBrief, mergeRunningStatus, readTypeFromConfig, parseProjectConfig, checkSitemapFiles, detectProjectFromDisk, enrichProjectConfigRoleSlots, enrichRoleSlotsWithRoleNotes } from "./vault-project-helpers.js";
import { PROJECTS_FOLDER, detectStorybookOnDisk, getVaultBasePath, stripAnsi, shellQuote, runAsync, findStorybookDir } from "./vault-project-cli.js";
import { ensureFlowtiCliRuntimeDeps, resolveFlowtiCliEntry } from "./flowti-cli-runtime.js";

/**
 * Run the Flowti vault CLI (`main.mjs`) after ensuring `.flowti/bin` exists and the bundle entry is present.
 */
async function runFlowtiCli(
	vaultBase: string,
	cliSubArgs: string[],
	onOutput?: OutputCallback,
): Promise<{ ok: boolean; error?: string }> {
	const binDir = join(vaultBase, ".flowti", "bin");
	const ensured = await ensureFlowtiCliRuntimeDeps(binDir, onOutput);
	if (!ensured.ok) return ensured;
	const entry = resolveFlowtiCliEntry(binDir);
	return runAsync("node", [entry, ...cliSubArgs], vaultBase, onOutput);
}

export class VaultProjectService implements IProjectService {
	private app: App;
	private runningProcesses = new Map<string, { pid: number; url: string }>();

	constructor(app: App) { this.app = app; }

	async listProjects(): Promise<ProjectSummary[]> {
		const projectsFolder = this.app.vault.getAbstractFileByPath(PROJECTS_FOLDER);
		if (!projectsFolder || !("children" in projectsFolder)) return [];
		// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- narrowed by "children" check above
		const folder = projectsFolder as TFolder;
		const projects: ProjectSummary[] = [];
		const basePath = getVaultBasePath(this.app);
		for (const child of folder.children) {
			if (!("children" in child)) continue;
			// eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- narrowed by "children" check
			const projectFolder = child as TFolder;
			const name = projectFolder.name;
			const notePath = `${PROJECTS_FOLDER}/${name}/${name}.md`;
			const noteInfo = await resolveNoteInfoAsync(this.app, notePath, basePath);
			const absPath = join(basePath, PROJECTS_FOLDER, name);
			const storybook = mergeRunningStatus(detectStorybookOnDisk(absPath), this.runningProcesses.get(name));
			const type = readTypeFromConfig(absPath, noteInfo.type);
			projects.push({ name, type, hasNote: noteInfo.hasNote, storybook });
		}
		return projects.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getProject(name: string): Promise<ProjectDetail | undefined> {
		const projectPath = `${PROJECTS_FOLDER}/${name}`;
		const basePath = getVaultBasePath(this.app);
		const absPath = join(basePath, PROJECTS_FOLDER, name);
		const projectFolder = this.app.vault.getAbstractFileByPath(projectPath);
		if (!projectFolder && !existsSync(absPath)) return undefined;
		const notePath = `${PROJECTS_FOLDER}/${name}/${name}.md`;
		const noteInfo = await resolveNoteInfoAsync(this.app, notePath, basePath);
		const noteFile = this.app.vault.getAbstractFileByPath(notePath) as TFile | null;
		const brief = noteFile && noteInfo.hasNote ? readBrief(this.app, noteFile) : undefined;
		let storybook = mergeRunningStatus(detectStorybookOnDisk(absPath), this.runningProcesses.get(name));
		const parsed = parseProjectConfig(absPath);
		const type = parsed.type ?? noteInfo.type;
		if (parsed.framework) storybook = { ...storybook, framework: parsed.framework };
		const sitemapInfo = checkSitemapFiles(absPath);
		const config = parsed.config ? enrichProjectConfigRoleSlots(basePath, absPath, parsed.config) : parsed.config;
		return { name, type, hasNote: noteInfo.hasNote, notePath: noteInfo.hasNote ? notePath : null, projectPath, ...sitemapInfo, brief, storybook, config };
	}

	async installStorybook(project: string, framework: StorybookFramework, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["storybook:install", `--project=${project}`, `--framework=${framework}`], onOutput);
	}

	async startStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		const { spawn } = await import("node:child_process");
		const cwd = join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
		const port = 6006; const url = `http://localhost:${port}`;
		const configDir = findStorybookDir(cwd);
		try {
			const sbParent = join(configDir, "..");
			const child = spawn("npx", ["storybook", "dev", "-p", String(port), "--no-open", "--ci", "--config-dir", configDir].map(shellQuote), {
				cwd: sbParent, stdio: "pipe", shell: true, windowsHide: true,
				env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
			});
			const pid = child.pid ?? 0;
			if (pid > 0) this.runningProcesses.set(project, { pid, url });
			child.stdout?.on("data", (chunk: Buffer) => { for (const line of stripAnsi(chunk.toString()).split("\n").filter(Boolean)) onOutput?.(line); });
			child.stderr?.on("data", (chunk: Buffer) => { for (const line of stripAnsi(chunk.toString()).split("\n").filter(Boolean)) onOutput?.(line); });
			child.on("error", (err) => { onOutput?.(`Error: ${err.message}`); this.runningProcesses.delete(project); });
			child.on("close", (code) => { if (code !== 0) onOutput?.(`Process exited with code ${code}`); this.runningProcesses.delete(project); });
			child.unref();
			return { ok: true, url, pid };
		} catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Start failed" }; }
	}

	async stopStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const running = this.runningProcesses.get(project);
		const port = 6006;
		if (running?.pid) await runAsync("taskkill", ["/F", "/T", "/PID", String(running.pid)], ".");
		if (process.platform === "win32") {
			await runAsync("powershell", ["-Command", `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`], ".");
		} else { await runAsync("sh", ["-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null`], "."); }
		this.runningProcesses.delete(project);
		return { ok: true };
	}

	async buildStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		const cwd = join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
		const result = await runAsync("npx", ["storybook", "build", "--config-dir", findStorybookDir(cwd)], cwd, onOutput);
		return result.ok ? { ...result, outputDir: join(cwd, "storybook-static") } : result;
	}

	async scaffoldStorybook(project: string, onOutput?: OutputCallback, opts?: { adoptImport?: boolean }): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const args = ["storybook:scaffold", `--project=${project}`];
		if (opts?.adoptImport) args.push("--adopt-import");
		return runFlowtiCli(vaultBase, args, onOutput);
	}

	async importMarkdownSitemap(project: string, sourcePath: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["storybook:import", `--project=${project}`, `--source=${join(vaultBase, sourcePath)}`], onOutput);
	}

	async saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const fields = config.requiredFields.join(",");
		return runFlowtiCli(vaultBase, [
			"storybook:import", "--save-config",
			`--project=${project}`,
			`--source=${config.path}`,
			`--strategy=${config.strategy}`,
			`--fields=${fields}`,
		], onOutput);
	}

	async cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["storybook:clean", `--project=${project}`]);
	}

	async importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const args = ["storybook:canvas-import", `--project=${project}`];
		if (opts?.merge) args.push("--merge");
		return runFlowtiCli(vaultBase, args, onOutput);
	}

	async generateSitemapCanvas(project: string, onOutput?: OutputCallback, opts?: { preset?: string; force?: boolean }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const args = ["storybook:canvas-generate", `--project=${project}`];
		if (opts?.preset) args.push(`--preset=${opts.preset}`);
		if (opts?.force) args.push("--force");
		return runFlowtiCli(vaultBase, args, onOutput);
	}

	async importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const targetDir = join(vaultBase, PROJECTS_FOLDER, name);
		if (existsSync(targetDir)) return { ok: false, error: `Folder "${name}" already exists` };
		if (mode === "submodule") return runAsync("git", ["-c", "core.longpaths=true", "submodule", "add", url, `${PROJECTS_FOLDER}/${name}`], vaultBase, onOutput);
		const cloneResult = await runAsync("git", ["-c", "core.longpaths=true", "clone", url, targetDir], vaultBase, onOutput);
		if (!cloneResult.ok) return cloneResult;
		const gitDir = join(targetDir, ".git");
		if (existsSync(gitDir)) {
			const removeCmd = process.platform === "win32" ? { cmd: "cmd", args: ["/c", "rmdir", "/s", "/q", gitDir] } : { cmd: "rm", args: ["-rf", gitDir] };
			const removeResult = await runAsync(removeCmd.cmd, removeCmd.args, vaultBase);
			if (!removeResult.ok) return { ok: false, error: "Failed to detach from remote (could not remove .git directory)" };
		}
		return { ok: true };
	}

	async detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; buildCommand?: string; testCommand?: string; lintCommand?: string; error?: string }> {
		try { return { ok: true, ...detectProjectFromDisk(join(getVaultBasePath(this.app), PROJECTS_FOLDER, name)) }; }
		catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Detection failed" }; }
	}

	async bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const args = ["project:bootstrap", `--project=${name}`];
		if (config.build) args.push(`--build=${config.build}`);
		if (config.test) args.push(`--test=${config.test}`);
		if (config.lint) args.push(`--lint=${config.lint}`);
		if (config.storybook) args.push(`--storybook=${config.storybook}`);
		return runFlowtiCli(vaultBase, args);
	}

	async createEmptyProject(name: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["project:create", `--name=${name}`], onOutput);
	}

	private previewServers = new Map<string, { close: () => void; url: string }>();

	async previewStorybook(project: string): Promise<{ ok: boolean; url?: string; error?: string }> {
		const existing = this.previewServers.get(project);
		if (existing) return { ok: true, url: existing.url };
		const vaultBase = getVaultBasePath(this.app);
		const staticDir = join(vaultBase, PROJECTS_FOLDER, project, "components", "storybook-static");
		if (!existsSync(staticDir)) return { ok: false, error: "No static build found" };
		try {
			const http = await import("node:http");
			const fs = await import("node:fs");
			const nodePath = await import("node:path");
			const port = 6007;
			const MIME: Record<string, string> = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
			const server = http.createServer((req, res) => {
				res.setHeader("Access-Control-Allow-Origin", "*");
				const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
				const safePath = urlPath === "/" ? "/index.html" : urlPath;
				const filePath = nodePath.join(staticDir, ...safePath.split("/").filter(s => s && s !== ".."));
				if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
				res.writeHead(200, { "Content-Type": MIME[nodePath.extname(filePath).toLowerCase()] ?? "application/octet-stream" });
				res.end(fs.readFileSync(filePath));
			});
			await new Promise<void>((resolve) => server.listen(port, resolve));
			const url = `http://localhost:${port}`;
			this.previewServers.set(project, { close: () => server.close(), url });
			return { ok: true, url };
		} catch (err) { return { ok: false, error: String(err) }; }
	}

	async stopPreview(project: string): Promise<{ ok: boolean; error?: string }> {
		const server = this.previewServers.get(project);
		if (server) { server.close(); this.previewServers.delete(project); }
		return { ok: true };
	}

	private resolveProjectPath(project: string): string { return join(getVaultBasePath(this.app), PROJECTS_FOLDER, project); }

	async getHealth(project: string): Promise<{ ok: boolean; score?: HealthScore; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const lines: string[] = [];
		const result = await runFlowtiCli(vaultBase, ["health", `--project=${project}`, "--format=json"], (line) => {
			if (line !== "Done.") lines.push(line);
		});
		if (!result.ok) return { ok: false, error: result.error ?? "Health check failed" };
		try { return { ok: true, score: (JSON.parse(lines.join("")) as { score?: HealthScore }).score }; }
		catch { return { ok: false, error: "Failed to parse health output" }; }
	}

	async getTodos(project: string): Promise<{ items: TodoItem[]; exists: boolean }> {
		const todoPath = join(this.resolveProjectPath(project), "TODO.md");
		if (!existsSync(todoPath)) return { items: [], exists: false };
		return { items: parseTodos(readFileSync(todoPath, "utf-8")), exists: true };
	}

	async addTodo(project: string, text: string): Promise<{ ok: boolean }> {
		const todoPath = join(this.resolveProjectPath(project), "TODO.md");
		writeFileSync(todoPath, addTodoLine(existsSync(todoPath) ? readFileSync(todoPath, "utf-8") : "", text), "utf-8");
		return { ok: true };
	}

	async toggleTodo(project: string, index: number): Promise<{ ok: boolean }> {
		const todoPath = join(this.resolveProjectPath(project), "TODO.md");
		if (!existsSync(todoPath)) return { ok: false };
		writeFileSync(todoPath, toggleTodoLine(readFileSync(todoPath, "utf-8"), index), "utf-8");
		return { ok: true };
	}

	async deleteTodo(project: string, index: number): Promise<{ ok: boolean }> {
		const todoPath = join(this.resolveProjectPath(project), "TODO.md");
		if (!existsSync(todoPath)) return { ok: false };
		writeFileSync(todoPath, deleteTodoLine(readFileSync(todoPath, "utf-8"), index), "utf-8");
		return { ok: true };
	}

	async listEntities(project: string, entityType: CatalogEntityType): Promise<CatalogEntity[]> {
		const dir = join(this.resolveProjectPath(project), "docs", "catalog", entityType);
		if (!existsSync(dir)) return [];
		const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
		const entities: CatalogEntity[] = [];
		for (const file of files) {
			const entity = parseEntityFromMarkdown(readFileSync(join(dir, file), "utf-8"), `${project}/docs/catalog/${entityType}/${file}`);
			if (entity) entities.push(entity);
		}
		return entities;
	}

	async createEntity(project: string, entityType: CatalogEntityType, definition: CatalogEntityDef): Promise<{ ok: boolean; path?: string }> {
		const generators: Record<CatalogEntityType, (def: CatalogEntityDef, d: string) => string> = { domains: generateDomainMarkdown, services: generateServiceMarkdown, events: generateEventMarkdown, flows: generateFlowMarkdown };
		const md = generators[entityType](definition, new Date().toISOString().slice(0, 10));
		const slug = toKebabCase(definition.name);
		const dir = join(this.resolveProjectPath(project), "docs", "catalog", entityType);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, `${slug}.md`), md, "utf-8");
		return { ok: true, path: `${project}/docs/catalog/${entityType}/${slug}.md` };
	}

	async getReportGenerators(project: string): Promise<ReportGeneratorInfo[]> {
		const configPath = join(this.resolveProjectPath(project), "configs", "flowti.config.json");
		if (!existsSync(configPath)) return [];
		try { return (JSON.parse(readFileSync(configPath, "utf-8")) as { reports?: { generators?: ReportGeneratorInfo[] } }).reports?.generators ?? []; }
		catch { return []; }
	}

	async runReport(project: string, generatorId: string, onOutput?: OutputCallback): Promise<{ ok: boolean; metrics?: Record<string, number>; outputPath?: string; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, [`report:${generatorId}`, `--project=${project}`], onOutput);
	}

	async runAllReports(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; results?: import("../../domain/projects/types.js").ReportResult[]; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["reports", `--project=${project}`], onOutput);
	}

	async listComponents(project: string): Promise<ComponentEntry[]> {
		const projectPath = this.resolveProjectPath(project);
		const configPath = join(projectPath, "configs", "flowti.config.json");
		let sourcePath = "";
		if (existsSync(configPath)) {
			try { sourcePath = (JSON.parse(readFileSync(configPath, "utf-8")) as { components?: { markdownSource?: { path?: string } } }).components?.markdownSource?.path ?? ""; } catch { /* ignore */ }
		}
		if (!sourcePath) sourcePath = join(projectPath, ".storybook", "stories");
		else sourcePath = join(projectPath, sourcePath);
		if (!existsSync(sourcePath)) return [];
		const files = readdirSync(sourcePath).filter((f) => f.endsWith(".md"));
		const entries: ComponentEntry[] = [];
		for (const file of files) {
			const { fields, body } = parseFrontmatter(readFileSync(join(sourcePath, file), "utf-8"));
			if (!fields.name) continue;
			entries.push({ name: fields.name, category: fields.category ?? "uncategorized", status: fields.status, propCount: Math.max(0, (body.match(/^\|(?![\s-])/gm) ?? []).length - 1), slotCount: (body.match(/^- slot:/gim) ?? []).length });
		}
		return entries;
	}

	async listVaultAgents(): Promise<VaultAgentSummary[]> {
		return listVaultAgentSummaries(getVaultBasePath(this.app));
	}

	async saveTeamRoster(project: string, roleSlots: readonly TeamRoleSlot[], onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const configPath = join(this.resolveProjectPath(project), "configs", "flowti.config.json");
		if (!existsSync(configPath)) return { ok: false, error: "configs/flowti.config.json not found — bootstrap the project first." };
		let raw: Record<string, unknown>;
		try {
			raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
		} catch {
			return { ok: false, error: "Invalid flowti.config.json" };
		}
		const parsed = parseProjectConfig(this.resolveProjectPath(project));
		const prevRoster = parsed.config?.agents ?? [];
		const prevSlots = parsed.config?.roleSlots ?? [];
		const vaultBase = getVaultBasePath(this.app);
		const nextSlots = normalizeTeamRoleSlots(roleSlots).map((s) => ({
			...s,
			roleNotePath: s.roleNotePath?.trim() || projectRoleNoteRelativePath(project, s.id),
		}));
		const prevPaths = new Set(
			prevSlots.map((s) => (s.roleNotePath?.trim() ? s.roleNotePath.trim() : projectRoleNoteRelativePath(project, s.id))),
		);
		const nextPaths = new Set(nextSlots.map((s) => s.roleNotePath!));
		for (const slot of nextSlots) {
			const absFile = join(vaultBase, slot.roleNotePath!);
			mkdirSync(dirname(absFile), { recursive: true });
			const md = buildProjectRoleMarkdown({
				id: slot.id,
				role: slot.title,
				need: slot.need,
				skills: slot.roleSkills ?? [],
				summary: slot.roleSummary ?? "",
				body: slot.roleBody ?? "",
			});
			writeFileSync(absFile, md, "utf-8");
		}
		for (const rel of prevPaths) {
			if (nextPaths.has(rel)) continue;
			try {
				const absFile = join(vaultBase, rel);
				if (existsSync(absFile)) unlinkSync(absFile);
			} catch { /* ignore */ }
		}
		const newRoster = reconcileProjectRoster(prevRoster, prevSlots, nextSlots);
		const management = { ...((raw.management ?? {}) as Record<string, unknown>) };
		const agents = { ...((management.agents ?? {}) as Record<string, unknown>) };
		agents.roster = newRoster;
		agents.roleSlots = nextSlots.map((s) => {
			const row: Record<string, unknown> = { id: s.id, title: s.title, need: s.need, roleNotePath: s.roleNotePath };
			if (s.assignee) row.assignee = s.assignee;
			if (s.blueprint && Object.keys(s.blueprint).length > 0) row.blueprint = JSON.parse(JSON.stringify(s.blueprint)) as Record<string, unknown>;
			return row;
		});
		management.agents = agents;
		raw.management = management;
		writeFileSync(configPath, JSON.stringify(raw, null, "\t"), "utf-8");
		return runFlowtiCli(vaultBase, ["agent:dashboard-sync"], onOutput);
	}

	async createAgentFromRole(project: string, roleId: string, agentName: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const name = agentName.trim();
		if (!name) return { ok: false, error: "Agent name is required." };
		const parsed = parseProjectConfig(this.resolveProjectPath(project));
		const slots = parsed.config?.roleSlots ?? [];
		const vaultBase = getVaultBasePath(this.app);
		const enriched = enrichRoleSlotsWithRoleNotes(vaultBase, project, slots) ?? slots;
		const slot = enriched.find((s) => s.id === roleId);
		if (!slot) return { ok: false, error: "Role slot not found." };
		const { md: mdPath, json: jsonPath } = agentVaultPaths(name);
		if (this.app.vault.getAbstractFileByPath(mdPath)) return { ok: false, error: "An agent note with this filename already exists." };
		await mkdir(join(vaultBase, "03 - Resources", "Agents"), { recursive: true });
		const blueprint = mergeAgentBlueprintFromRoleSlot(slot);
		const mdBody = buildAgentMarkdownFile(name, Object.keys(blueprint).length > 0 ? blueprint : undefined);
		try {
			await this.app.vault.create(mdPath, mdBody);
		} catch (e) {
			return { ok: false, error: e instanceof Error ? e.message : "Failed to create agent note." };
		}
		const companion = buildAgentCompanionJson(Object.keys(blueprint).length > 0 ? blueprint : undefined);
		if (companion && !this.app.vault.getAbstractFileByPath(jsonPath)) {
			try {
				await this.app.vault.create(jsonPath, companion);
			} catch { /* optional */ }
		}
		const nextSlots = normalizeTeamRoleSlots(slots.map((s) => (s.id === roleId ? { ...s, assignee: name } : s)));
		return this.saveTeamRoster(project, nextSlots, onOutput);
	}
}
