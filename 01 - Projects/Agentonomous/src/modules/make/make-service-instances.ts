import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { FieldError, MakeError } from '../../domain/make/errors.js';
import type { BulkDeleteReport, CreateInstanceOptions, InstanceRef, ListTypesResult, NonEmptyArray } from '../../domain/make/types.js';
import {
	renderInstanceContent, resolveInstancePath, validateInstanceValues,
} from '../../domain/make/instance-ops.js';
import type { MakeService } from './make-service.js';
import type { PerTypeQueue } from './per-type-queue.js';

export type InstanceServiceMethods = Pick<MakeService, 'listInstances' | 'createInstance' | 'deleteInstance' | 'deleteInstances'>;

export type InstanceOpsInternal = InstanceServiceMethods & {
	listInstancesInFolder: (folder: string, typeId: string) => Promise<readonly InstanceRef[]>;
};

export interface InstanceOpsPeers {
	loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
	listTypes: () => Promise<Result<ListTypesResult, MakeError>>;
}

function basename(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? path : path.slice(idx + 1);
}

function dirname(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? '' : path.slice(0, idx);
}

function inferTypeId(path: string, types: readonly TypeSchema[]): string | null {
	const parent = dirname(path);
	const match = types.find((s) => s.instancesFolder.replace(/\/$/, '') === parent);
	return match?.id ?? null;
}

export function createInstanceOps(
	ports: ModulePorts,
	_getSettings: () => MakeSettings,
	peers: InstanceOpsPeers,
	queue: PerTypeQueue,
): InstanceOpsInternal {

	async function listInstancesInFolder(folder: string, typeId: string): Promise<readonly InstanceRef[]> {
		const listResult = await ports.vault.list(folder);
		if (listResult.kind === 'err') return [];
		const prefix = folder.endsWith('/') ? folder : `${folder}/`;
		const mdFiles = listResult.value.filter((p) =>
			p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && p.endsWith('.md'),
		);
		const refs: InstanceRef[] = [];
		for (const path of mdFiles) {
			const read = await ports.vault.read(path);
			if (read.kind === 'err') {
				ports.logger.warn('make', `skipping unreadable instance ${path}: ${read.error}`);
				continue;
			}
			const stem = path.slice(prefix.length, -'.md'.length);
			refs.push({
				typeId,
				path,
				title: stem,
				createdAt: new Date(read.value.stat.ctime).toISOString(),
				updatedAt: new Date(read.value.stat.mtime).toISOString(),
			});
		}
		return refs;
	}

	async function listInstances(typeId: string): Promise<Result<readonly InstanceRef[], MakeError>> {
		const typeResult = await peers.loadType(typeId);
		if (typeResult.kind === 'err') return typeResult;
		return ok(await listInstancesInFolder(typeResult.value.instancesFolder, typeId));
	}

	function mapPathError(reason: 'no-title-field-and-no-filename' | 'invalid-filename'): MakeError {
		if (reason === 'no-title-field-and-no-filename') return { kind: 'no-title-field' };
		const filenameIssue: FieldError = { kind: 'invalid-text', fieldName: '__filename__' };
		return { kind: 'invalid-values', issues: [filenameIssue] as unknown as NonEmptyArray<FieldError> };
	}

	async function buildInstanceRef(typeId: string, path: string): Promise<InstanceRef> {
		const stat = await ports.vault.read(path);
		const createdAt = stat.kind === 'ok' ? new Date(stat.value.stat.ctime).toISOString() : new Date().toISOString();
		const updatedAt = stat.kind === 'ok' ? new Date(stat.value.stat.mtime).toISOString() : createdAt;
		return { typeId, path, title: basename(path).replace(/\.md$/, ''), createdAt, updatedAt };
	}

	async function ensureInstanceParent(path: string): Promise<Result<void, MakeError>> {
		const instancesFolder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
		const ensured = await ports.vault.ensureFolder(instancesFolder);
		if (ensured.kind === 'err') {
			ports.logger.error('make-service', `ensureFolder failed for ${instancesFolder}`, ensured.error);
			return err({ kind: 'vault-error', cause: String(ensured.error) });
		}
		return ok(undefined);
	}

	async function writeInstanceFile(path: string, content: string, exists: boolean): Promise<Result<void, MakeError>> {
		const writeResult = exists
			? await ports.vault.update(path, content)
			: await ports.vault.create(path, content);
		if (writeResult.kind === 'err') {
			ports.logger.error('make-service', `createInstance: failed to write ${path}`, writeResult.error);
			return err({ kind: 'vault-error', cause: String(writeResult.error) });
		}
		return ok(undefined);
	}

	async function createInstance(
		typeId: string,
		raw: Record<string, unknown>,
		explicitFilename: string | null,
		options?: CreateInstanceOptions,
	): Promise<Result<InstanceRef, MakeError>> {
		const loaded = await peers.loadType(typeId);
		if (loaded.kind === 'err') return loaded;
		const schema = loaded.value;

		const validated = validateInstanceValues(schema, raw);
		if (validated.kind === 'err') return err({ kind: 'invalid-values', issues: validated.error });

		const resolved = resolveInstancePath(schema, validated.value, explicitFilename);
		if (resolved.kind === 'err') return err(mapPathError(resolved.error));
		const path = resolved.value;

		const exists = await ports.vault.exists(path);
		if (exists && options?.overwrite !== true) return err({ kind: 'instance-exists', path });

		// When creating (not updating) a brand-new instance, ensure the type's
		// instances folder exists. A fresh install has no Make/Instances/ —
		// without this, vault.create fails with ENOENT.
		if (!exists) {
			const ensured = await ensureInstanceParent(path);
			if (ensured.kind === 'err') return ensured;
		}

		const rendered = renderInstanceContent(schema, validated.value);
		const wrote = await writeInstanceFile(path, rendered.fullMarkdown, exists);
		if (wrote.kind === 'err') return wrote;

		const ref = await buildInstanceRef(typeId, path);
		ports.eventBus.emit('make:instance-created', { typeId, path });
		return ok(ref);
	}

	async function deleteInstance(path: string): Promise<Result<void, MakeError>> {
		const deleteResult = await ports.vault.delete(path);
		if (deleteResult.kind === 'err') {
			ports.logger.error('make-service', `deleteInstance: vault.delete failed for ${path}`, deleteResult.error);
			return err({ kind: 'vault-error', cause: String(deleteResult.error) });
		}

		const listResult = await peers.listTypes();
		const types = listResult.kind === 'ok' ? listResult.value.types : [];
		const typeId = inferTypeId(path, types);
		if (typeId !== null) {
			ports.eventBus.emit('make:instance-deleted', { typeId, path });
		} else {
			ports.eventBus.emit('make:orphan-deleted', { path });
		}
		return ok(undefined);
	}

	async function deleteInstances(
		typeId: string,
		paths: readonly string[],
	): Promise<Result<BulkDeleteReport, MakeError>> {
		if (paths.length === 0) return ok({ deletedPaths: [], failures: [] });
		return queue.enqueue(typeId, async () => {
			const deletedPaths: string[] = [];
			const failures:     Array<{ path: string; error: string }> = [];
			for (const path of paths) {
				const r = await ports.vault.delete(path);
				if (r.kind === 'ok') deletedPaths.push(path);
				else {
					ports.logger.error('make-service', `deleteInstances: vault.delete failed for ${path}`, r.error);
					failures.push({ path, error: String(r.error) });
				}
			}
			ports.eventBus.emit('make:instances-deleted-batch', { typeId, deletedPaths, failures });
			return ok({ deletedPaths, failures });
		});
	}

	return {
		listInstances,
		createInstance,
		deleteInstance,
		deleteInstances,
		listInstancesInFolder,
	};
}
