import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { serializeTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { Field, TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { FieldRename, MakeError, SchemaError } from '../../domain/make/errors.js';
import type {
	FailedMove, InstanceRef, ListTypesResult, MoveReport, NonEmptyArray,
	TypeSchemaPatch, UpdateTypeOptions, UpdateTypeResult,
} from '../../domain/make/types.js';
import type { MakeService } from './make-service.js';
import type { TypeOpsPeers } from './make-service-types.js';

export interface UpdateTypeOpsDeps {
	readonly ports: ModulePorts;
	readonly getSettings: () => MakeSettings;
	readonly peers: TypeOpsPeers;
	readonly loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
	readonly listTypes: () => Promise<Result<ListTypesResult, MakeError>>;
	readonly validateSchema: (schema: {
		readonly name: string;
		readonly instancesFolder: string;
		readonly fields: readonly Field[];
	}) => SchemaError[];
}

export interface UpdateTypeMethods {
	updateType:       MakeService['updateType'];
	retryFailedMoves: MakeService['retryFailedMoves'];
}

function basename(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? path : path.slice(idx + 1);
}

function folderOf(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? '' : path.slice(0, idx);
}

export function createUpdateTypeOps(deps: UpdateTypeOpsDeps): UpdateTypeMethods {
	const { ports, getSettings, peers, loadType, listTypes, validateSchema } = deps;

	async function detectFieldRename(
		currentFields: readonly Field[], next: TypeSchema, typeId: string,
	): Promise<MakeError | null> {
		const renames: FieldRename[] = [];
		for (let i = 0; i < Math.min(currentFields.length, next.fields.length); i++) {
			const before = currentFields[i]!;
			const after = next.fields[i]!;
			if (before.kind === after.kind && before.name !== after.name && !next.fields.some((f) => f.name === before.name)) {
				renames.push({ oldName: before.name, newName: after.name, position: i });
			}
		}
		if (renames.length === 0) return null;
		const instanceList = await peers.listInstances(typeId);
		const affectedCount = instanceList.kind === 'ok' ? instanceList.value.length : 0;
		return {
			kind: 'invalid-schema',
			issues: [{ kind: 'field-rename-warning', renames, affectedCount }] as unknown as NonEmptyArray<SchemaError>,
		};
	}

	async function writeNextSchema(next: TypeSchema): Promise<Result<void, MakeError>> {
		const jsonPath = `${getSettings().typesFolder.replace(/\/$/, '')}/${next.id}.json`;
		const writeResult = await ports.vault.update(jsonPath, serializeTypeSchema(next));
		if (writeResult.kind === 'err') return err({ kind: 'vault-error', cause: String(writeResult.error) });
		return ok(undefined);
	}

	async function moveAllInstances(
		oldInstances: readonly InstanceRef[], oldFolder: string, nextFolder: string,
	): Promise<MoveReport> {
		const failedMoves: FailedMove[] = [];
		let movedCount = 0;
		for (const ref of oldInstances) {
			const newPath = `${nextFolder}/${basename(ref.path)}`;
			const rename = await ports.vault.rename(ref.path, newPath);
			if (rename.kind === 'err') {
				failedMoves.push({ path: ref.path, cause: String(rename.error) });
				continue;
			}
			movedCount += 1;
		}
		return { oldFolder, newFolder: nextFolder, movedCount, failedMoves };
	}

	async function preflightUpdate(
		prev: TypeSchema, next: TypeSchema, changes: TypeSchemaPatch, options: UpdateTypeOptions, typeId: string,
	): Promise<MakeError | null> {
		if (options.acknowledgeRenames !== true && changes.fields !== undefined) {
			const renameErr = await detectFieldRename(prev.fields, next, typeId);
			if (renameErr !== null) return renameErr;
		}
		const schemaErrors = validateSchema(next);
		if (schemaErrors.length > 0) {
			return { kind: 'invalid-schema', issues: schemaErrors as unknown as NonEmptyArray<SchemaError> };
		}
		if (changes.name !== undefined && changes.name !== prev.name) {
			const existing = await listTypes();
			if (existing.kind === 'ok') {
				const collision = existing.value.types.find(
					(t) => t.id !== prev.id && t.name.toLowerCase() === next.name.toLowerCase(),
				);
				if (collision !== undefined) return { kind: 'duplicate-name', name: next.name };
			}
		}
		return null;
	}

	async function commitNoMove(next: TypeSchema): Promise<Result<UpdateTypeResult, MakeError>> {
		const w = await writeNextSchema(next);
		if (w.kind === 'err') return w;
		ports.eventBus.emit('make:type-updated', { schema: next });
		return ok({ schema: next });
	}

	async function commitWithMove(
		next: TypeSchema, oldInstances: readonly InstanceRef[], prevFolder: string, nextFolder: string,
	): Promise<Result<UpdateTypeResult, MakeError>> {
		const moveReport = await moveAllInstances(oldInstances, prevFolder, nextFolder);
		const w = await writeNextSchema(next);
		if (w.kind === 'err') return w;
		ports.eventBus.emit('make:instances-moved', { typeId: next.id, report: moveReport });
		ports.eventBus.emit('make:type-updated', { schema: next });
		return ok({ schema: next, moveReport });
	}

	async function updateTypeImpl(
		typeId: string,
		changes: TypeSchemaPatch,
		options: UpdateTypeOptions,
	): Promise<Result<UpdateTypeResult, MakeError>> {
		const current = await loadType(typeId);
		if (current.kind === 'err') return current;
		const prev = current.value;
		const next: TypeSchema = { ...prev, ...changes, updatedAt: new Date().toISOString() };
		const preflight = await preflightUpdate(prev, next, changes, options, typeId);
		if (preflight !== null) return err(preflight);

		const prevFolder = prev.instancesFolder.trim();
		const nextFolder = next.instancesFolder.trim();
		if (prevFolder === nextFolder) return commitNoMove(next);

		const oldInstances = await peers.listInstancesInFolder(prevFolder, typeId);
		if (oldInstances.length === 0) return commitNoMove(next);
		if (options.moveInstances !== true) {
			return err({ kind: 'instances-move-required', oldFolder: prevFolder, newFolder: nextFolder, count: oldInstances.length });
		}
		return commitWithMove(next, oldInstances, prevFolder, nextFolder);
	}

	async function retryFailedMovesImpl(
		typeId: string, failedPaths: readonly string[],
	): Promise<Result<MoveReport, MakeError>> {
		const loaded = await loadType(typeId);
		if (loaded.kind === 'err') return loaded;
		const toFolder = loaded.value.instancesFolder.trim();
		const oldFolder = failedPaths.length > 0 ? folderOf(failedPaths[0]!) : '';
		const failedMoves: FailedMove[] = [];
		let movedCount = 0;
		for (const oldPath of failedPaths) {
			const newPath = `${toFolder}/${basename(oldPath)}`;
			const rename = await ports.vault.rename(oldPath, newPath);
			if (rename.kind === 'err') {
				failedMoves.push({ path: oldPath, cause: String(rename.error) });
				continue;
			}
			movedCount += 1;
		}
		const report: MoveReport = { oldFolder, newFolder: toFolder, movedCount, failedMoves };
		if (movedCount > 0) ports.eventBus.emit('make:instances-moved', { typeId, report });
		return ok(report);
	}

	// Per-typeId serialization. Concurrent updateType/retryFailedMoves calls for
	// the same type queue behind each other; loadType in the next call observes
	// the previous call's committed schema, preventing stale-write races (e.g.
	// two Obsidian panes saving the same type at once).
	const chains = new Map<string, Promise<unknown>>();
	function enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T> {
		const previous = chains.get(typeId) ?? Promise.resolve();
		const current = previous.then(work);
		chains.set(typeId, current.catch(() => undefined));
		return current;
	}

	function updateType(
		typeId: string,
		changes: TypeSchemaPatch,
		options: UpdateTypeOptions = {},
	): Promise<Result<UpdateTypeResult, MakeError>> {
		return enqueue(typeId, () => updateTypeImpl(typeId, changes, options));
	}

	function retryFailedMoves(
		typeId: string, failedPaths: readonly string[],
	): Promise<Result<MoveReport, MakeError>> {
		return enqueue(typeId, () => retryFailedMovesImpl(typeId, failedPaths));
	}

	return { updateType, retryFailedMoves };
}
