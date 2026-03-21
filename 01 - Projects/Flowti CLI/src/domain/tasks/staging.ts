import type { IFileSystem, IPaths } from "../../infrastructure/types.js";

export interface StagingManifest {
	readonly taskId: string;
	readonly agentName: string;
	readonly operation: string;
	readonly files: readonly StagedFile[];
	readonly createdAt: string;
	readonly status: "pending" | "approved" | "rejected";
}

export interface StagedFile {
	readonly path: string;
	readonly action: "create" | "modify" | "tag" | "move" | "link";
	readonly previewPath: string;
}

type StagingDeps = {
	readonly disk: Pick<IFileSystem, "existsSync" | "readFileSync" | "writeFileSync" | "mkdirSync" | "readdirSync" | "copyFileSync" | "rmSync">;
	readonly paths: Pick<IPaths, "join" | "dirname">;
};

const STAGING_DIR = ".flowti/var/staging";
const MANIFEST_FILE = "manifest.json";

function stagingPath(deps: StagingDeps, vaultRoot: string, taskId: string): string {
	return deps.paths.join(vaultRoot, STAGING_DIR, taskId);
}

function manifestPath(deps: StagingDeps, vaultRoot: string, taskId: string): string {
	return deps.paths.join(stagingPath(deps, vaultRoot, taskId), MANIFEST_FILE);
}

export function createStagingArea(
	deps: StagingDeps,
	vaultRoot: string,
	manifest: StagingManifest,
): string {
	const dir = stagingPath(deps, vaultRoot, manifest.taskId);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(
		manifestPath(deps, vaultRoot, manifest.taskId),
		JSON.stringify(manifest, null, 2),
		"utf-8",
	);
	return dir;
}

export function readManifest(
	deps: StagingDeps,
	vaultRoot: string,
	taskId: string,
): StagingManifest | null {
	const mPath = manifestPath(deps, vaultRoot, taskId);
	if (!deps.disk.existsSync(mPath)) return null;
	try {
		const raw = deps.disk.readFileSync(mPath, "utf-8");
		return JSON.parse(raw) as StagingManifest;
	} catch {
		return null;
	}
}

export function approveStaged(
	deps: StagingDeps,
	vaultRoot: string,
	taskId: string,
): boolean {
	const manifest = readManifest(deps, vaultRoot, taskId);
	if (!manifest) return false;

	for (const file of manifest.files) {
		const destDir = deps.paths.dirname(deps.paths.join(vaultRoot, file.path));
		deps.disk.mkdirSync(destDir, { recursive: true });
		deps.disk.copyFileSync(
			deps.paths.join(vaultRoot, file.previewPath),
			deps.paths.join(vaultRoot, file.path),
		);
	}

	const updated: StagingManifest = { ...manifest, status: "approved" };
	deps.disk.writeFileSync(
		manifestPath(deps, vaultRoot, taskId),
		JSON.stringify(updated, null, 2),
		"utf-8",
	);
	return true;
}

export function rejectStaged(
	deps: StagingDeps,
	vaultRoot: string,
	taskId: string,
): boolean {
	const manifest = readManifest(deps, vaultRoot, taskId);
	if (!manifest) return false;

	const updated: StagingManifest = { ...manifest, status: "rejected" };
	deps.disk.writeFileSync(
		manifestPath(deps, vaultRoot, taskId),
		JSON.stringify(updated, null, 2),
		"utf-8",
	);

	const dir = stagingPath(deps, vaultRoot, taskId);
	deps.disk.rmSync(dir, { recursive: true, force: true });
	return true;
}

export function listPendingReviews(
	deps: StagingDeps,
	vaultRoot: string,
): StagingManifest[] {
	const baseDir = deps.paths.join(vaultRoot, STAGING_DIR);
	if (!deps.disk.existsSync(baseDir)) return [];

	const entries = deps.disk.readdirSync(baseDir);
	const results: StagingManifest[] = [];

	for (const entry of entries) {
		const manifest = readManifest(deps, vaultRoot, entry);
		if (manifest && manifest.status === "pending") {
			results.push(manifest);
		}
	}

	return results;
}
