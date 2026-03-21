import type { TaskDefinition, TaskSummary, TaskType, TaskStatus, TaskPriority, TaskTrustTier } from "./task-types.js";

type TaskStoreDeps = {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc?: string): string;
		writeFileSync(p: string, c: string, enc?: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
		readdirSync(p: string): string[];
		unlinkSync(p: string): void;
	};
	readonly paths: {
		join(...segs: string[]): string;
		basename(p: string, ext?: string): string;
		dirname(p: string): string;
	};
};

const DIR = "docs/tasks";
const MD = ".md";

function parseFrontmatter(raw: string): Record<string, string> {
	const m = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return {};
	const fm: Record<string, string> = {};
	for (const line of m[1].split("\n")) {
		const idx = line.indexOf(":");
		if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
	}
	return fm;
}

function parseArrayField(raw: string): string[] {
	const trimmed = raw.replace(/^\[/, "").replace(/\]$/, "");
	if (!trimmed) return [];
	return trimmed.split(",").map(s => s.trim());
}

function toSummary(fm: Record<string, string>, file: string): TaskSummary {
	return {
		id: fm.id ?? "",
		type: (fm.taskType ?? "one-off") as TaskType,
		title: fm.title ?? "",
		assignee: fm.assignee ?? "",
		creator: fm.creator ?? "",
		priority: (fm.priority ?? "normal") as TaskPriority,
		trustTier: (fm.trustTier ?? "review") as TaskTrustTier,
		status: (fm.status ?? "pending") as TaskStatus,
		reward: { xp: Number(fm.rewardXp) || 0, coin: Number(fm.rewardCoin) || 0 },
		tags: parseArrayField(fm.tags ?? ""),
		createdAt: fm.createdAt ?? "",
		completedAt: fm.completedAt ?? "",
		journeyId: fm.journeyId ?? "",
		file,
	};
}

function buildMd(def: TaskDefinition): string {
	const lines = [
		"---",
		"type: Task",
		`id: ${def.id}`,
		`taskType: ${def.type}`,
		`title: ${def.title}`,
		def.assignee ? `assignee: ${def.assignee}` : null,
		`creator: ${def.creator}`,
		`priority: ${def.priority}`,
		`trustTier: ${def.trustTier}`,
		`status: ${def.status}`,
		`rewardXp: ${def.reward.xp}`,
		`rewardCoin: ${def.reward.coin}`,
		`tags: [${def.tags.join(", ")}]`,
		`createdAt: ${def.createdAt}`,
		def.completedAt ? `completedAt: ${def.completedAt}` : null,
		def.journeyId ? `journeyId: ${def.journeyId}` : null,
		"---",
		"",
		`# ${def.title}`,
		"",
	];
	return lines.filter(Boolean).join("\n");
}

export const taskStore = {
	list(deps: TaskStoreDeps, projectPath: string): TaskSummary[] {
		const dir = deps.paths.join(projectPath, DIR);
		if (!deps.disk.existsSync(dir)) return [];
		const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(MD));
		const results: TaskSummary[] = [];
		for (const f of files) {
			const path = deps.paths.join(dir, f);
			const raw = deps.disk.readFileSync(path, "utf-8");
			const fm = parseFrontmatter(raw);
			if (fm.type !== "Task") continue;
			results.push(toSummary(fm, path));
		}
		return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	},

	read(deps: TaskStoreDeps, projectPath: string, id: string): TaskSummary | undefined {
		return this.list(deps, projectPath).find(t => t.id === id);
	},

	create(deps: TaskStoreDeps, projectPath: string, def: TaskDefinition): string {
		const dir = deps.paths.join(projectPath, DIR);
		deps.disk.mkdirSync(dir, { recursive: true });
		const filename = `${def.id}${MD}`;
		const path = deps.paths.join(dir, filename);
		deps.disk.writeFileSync(path, buildMd(def));
		return path;
	},

	updateField(deps: TaskStoreDeps, projectPath: string, id: string, field: string, value: string): boolean {
		const dir = deps.paths.join(projectPath, DIR);
		const path = deps.paths.join(dir, `${id}${MD}`);
		if (!deps.disk.existsSync(path)) return false;
		const raw = deps.disk.readFileSync(path, "utf-8");
		const fm = parseFrontmatter(raw);
		fm[field] = value;
		const updated = raw.replace(/^---\n[\s\S]*?\n---/, "---\n" + Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n---");
		deps.disk.writeFileSync(path, updated);
		return true;
	},

	remove(deps: TaskStoreDeps, projectPath: string, id: string): void {
		const dir = deps.paths.join(projectPath, DIR);
		const path = deps.paths.join(dir, `${id}${MD}`);
		if (deps.disk.existsSync(path)) deps.disk.unlinkSync(path);
	},
};
