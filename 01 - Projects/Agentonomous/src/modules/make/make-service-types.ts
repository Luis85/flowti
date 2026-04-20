import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { trySync } from '../../domain/shared/try-async.js';
import { parseTypeSchema, serializeTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { Field, TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { CorruptTypeRef, MakeError, SchemaError } from '../../domain/make/errors.js';
import type {
	DeleteTypeOptions, DeleteTypeReport, FailedDelete, InstanceRef, ListTypesResult,
	NewTypeDraft, NonEmptyArray,
} from '../../domain/make/types.js';
import { slugifyTypeName } from '../../domain/make/type-id.js';
import { validateTypeName, validateFieldName, validateInstancesFolder } from '../../domain/make/name-validation.js';
import { generateBaseYaml } from '../../domain/make/base-file.js';
import { FIELD_KINDS } from '../../domain/make/field-kinds/index.js';
import type { MakeService } from './make-service.js';
import { createUpdateTypeOps } from './update-type-ops.js';
import type { PerTypeQueue } from './per-type-queue.js';

export type TypeServiceMethods = Pick<MakeService, 'listTypes' | 'loadType' | 'createType' | 'updateType' | 'retryFailedMoves' | 'deleteType' | 'toggleFavorite'>;

export interface TypeOpsPeers {
	listInstances: (typeId: string) => Promise<Result<readonly InstanceRef[], MakeError>>;
	listInstancesInFolder: (folder: string, typeId: string) => Promise<readonly InstanceRef[]>;
}

function basename(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? path : path.slice(idx + 1);
}

export function createTypeOps(
	ports: ModulePorts,
	getSettings: () => MakeSettings,
	peers: TypeOpsPeers,
	queue: PerTypeQueue,
): TypeServiceMethods {
	async function listTypes(): Promise<Result<ListTypesResult, MakeError>> {
		const settings = getSettings();
		const folderExists = await ports.vault.exists(settings.typesFolder);
		if (!folderExists) return ok({ types: [], issues: [] });
		const listResult = await ports.vault.list(settings.typesFolder);
		if (listResult.kind === 'err') {
			ports.logger.error('make-service', `listTypes: vault.list failed for ${settings.typesFolder}`, listResult.error);
			return err({ kind: 'vault-error', cause: String(listResult.error) });
		}
		const prefix = settings.typesFolder.endsWith('/') ? settings.typesFolder : `${settings.typesFolder}/`;
		const children = listResult.value.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && p.endsWith('.json'));
		const schemas: TypeSchema[] = [];
		const issues: CorruptTypeRef[] = [];
		for (const path of children) {
			const read = await ports.vault.read(path);
			if (read.kind === 'err') {
				issues.push({ path, filename: basename(path), error: { kind: 'io-error', cause: String(read.error) } });
				continue;
			}
			const parsed = trySync(() => JSON.parse(read.value.content) as unknown, { code: 'MAKE_JSON_PARSE', source: 'make' });
			if (parsed.kind === 'err') {
				issues.push({ path, filename: basename(path), error: { kind: 'invalid-json', reason: parsed.error.message } });
				continue;
			}
			const schema = parseTypeSchema(parsed.value);
			if (schema.kind === 'err') {
				issues.push({ path, filename: basename(path), error: schema.error });
				continue;
			}
			schemas.push(schema.value);
		}
		return ok({ types: schemas, issues });
	}

	async function loadType(typeId: string): Promise<Result<TypeSchema, MakeError>> {
		const settings = getSettings();
		const path = `${settings.typesFolder.replace(/\/$/, '')}/${typeId}.json`;
		const exists = await ports.vault.exists(path);
		if (!exists) return err({ kind: 'type-not-found', typeId });
		const read = await ports.vault.read(path);
		if (read.kind === 'err') {
			ports.logger.error('make-service', `loadType: vault.read failed for ${path}`, read.error);
			return err({ kind: 'vault-error', cause: read.error });
		}
		const parsed = trySync(() => JSON.parse(read.value.content) as unknown, { code: 'MAKE_JSON_PARSE', source: 'make' });
		if (parsed.kind === 'err') return err({ kind: 'invalid-schema', issues: [{ kind: 'invalid-json', reason: parsed.error.message }] });
		const schemaResult = parseTypeSchema(parsed.value);
		if (schemaResult.kind === 'err') return err({ kind: 'invalid-schema', issues: [schemaResult.error] });
		// Orphan-base reconciliation: if the loaded schema has no baseFile stamp but a
		// .base file exists at the conventional path, adopt it as the baseFile. This
		// self-heals after a crash between createType steps 6 and 7 (see Chunk 3 spec §3).
		let schemaWithBase = schemaResult.value;
		if (schemaWithBase.baseFile === undefined) {
			const basesFolder = settings.basesFolder.replace(/\/$/, '');
			const conventionalPath = `${basesFolder}/${schemaWithBase.id}.base`;
			const baseExists = await ports.vault.exists(conventionalPath);
			if (baseExists) {
				const baseRead = await ports.vault.read(conventionalPath);
				if (baseRead.kind === 'ok') {
					const mtimeIso = new Date(baseRead.value.stat.mtime).toISOString();
					schemaWithBase = { ...schemaWithBase, baseFile: { path: conventionalPath, generatedAt: mtimeIso } };
				}
			}
		}
		return ok(schemaWithBase);
	}

	async function uniqueSlug(baseSlug: string): Promise<string | null> {
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		for (let i = 1; i <= 100; i++) {
			const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`;
			const jsonPath = `${typesFolder}/${candidate}.json`;
			const basePath = `${basesFolder}/${candidate}.base`;
			const jsonExists = await ports.vault.exists(jsonPath);
			const baseExists = await ports.vault.exists(basePath);
			if (!jsonExists && !baseExists) return candidate;
		}
		return null;
	}

	function validateSchema(schema: {
		readonly name: string;
		readonly instancesFolder: string;
		readonly fields: readonly (Field)[];
	}): SchemaError[] {
		const errors: SchemaError[] = [];
		for (const field of schema.fields) {
			const nameResult = validateFieldName(field.name);
			if (nameResult.kind === 'err') errors.push(nameResult.error);
			errors.push(...FIELD_KINDS[field.kind].validateField(field as never));
		}
		const nameResult = validateTypeName(schema.name);
		if (nameResult.kind === 'err') errors.push(nameResult.error);
		const folderResult = validateInstancesFolder(schema.instancesFolder);
		if (folderResult.kind === 'err') errors.push(folderResult.error);
		return errors;
	}

	async function writeTypeFiles(
		jsonPath: string, basePath: string, schema: TypeSchema, now: string,
	): Promise<Result<TypeSchema, MakeError>> {
		// Step 4.5: ensure parent folders exist. Obsidian's vault.create fails
		// with ENOENT when the parent folder is missing — on a fresh install
		// neither Make/Types nor Make/Bases exists. ensureFolder is idempotent,
		// so the cost after the first create is negligible.
		const jsonFolder = jsonPath.includes('/') ? jsonPath.slice(0, jsonPath.lastIndexOf('/')) : '';
		const baseFolder = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '';
		const ensureJson = await ports.vault.ensureFolder(jsonFolder);
		if (ensureJson.kind === 'err') {
			ports.logger.error('make-service', `ensureFolder failed for ${jsonFolder}`, ensureJson.error);
			return err({ kind: 'vault-error', cause: ensureJson.error });
		}
		const ensureBase = await ports.vault.ensureFolder(baseFolder);
		if (ensureBase.kind === 'err') {
			ports.logger.error('make-service', `ensureFolder failed for ${baseFolder}`, ensureBase.error);
			return err({ kind: 'vault-error', cause: ensureBase.error });
		}
		// Step 5: write type JSON.
		const writeJson = await ports.vault.create(jsonPath, serializeTypeSchema(schema));
		if (writeJson.kind === 'err') {
			ports.logger.error('make-service', `createType: failed to write ${jsonPath}`, writeJson.error);
			return err({ kind: 'vault-error', cause: writeJson.error });
		}
		// Step 6: generate + write base YAML (partial success on failure).
		const writeBase = await ports.vault.create(basePath, generateBaseYaml(schema));
		if (writeBase.kind === 'err') {
			ports.logger.warn('make-service', `createType: base-file write failed for ${basePath}`, writeBase.error);
			ports.notifications.warn(ports.t.t('make.notify.baseFailed'));
			return ok(schema);
		}
		// Step 7: stamp baseFile + re-write JSON (partial success on failure).
		const stamped: TypeSchema = { ...schema, baseFile: { path: basePath, generatedAt: now } };
		const writeStamp = await ports.vault.update(jsonPath, serializeTypeSchema(stamped));
		if (writeStamp.kind === 'err') {
			ports.logger.warn('make-service', `createType: base-stamp write failed for ${jsonPath}`, writeStamp.error);
			ports.notifications.warn(ports.t.t('make.error.baseStampFailed'));
			return ok(schema);
		}
		return ok(stamped);
	}

	async function createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>> {
		// Step 1: validate all fields + type name + folder.
		const schemaErrors = validateSchema(draft);
		if (schemaErrors.length > 0) {
			return err({ kind: 'invalid-schema', issues: schemaErrors as unknown as NonEmptyArray<SchemaError> });
		}
		// Step 2: soft name uniqueness (in-memory cache shortcut).
		const existing = await listTypes();
		if (existing.kind === 'ok') {
			const collision = existing.value.types.find((t) => t.name.toLowerCase() === draft.name.toLowerCase());
			if (collision !== undefined) return err({ kind: 'duplicate-name', name: draft.name });
		}
		// Step 3: generate id via disk probe (authoritative).
		const slugResult = await uniqueSlug(slugifyTypeName(draft.name));
		if (slugResult === null) return err({ kind: 'vault-error', cause: 'slug-exhaustion' });
		// Step 4: stamp timestamps.
		const now = new Date().toISOString();
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const schemaPreStamp: TypeSchema = {
			id: slugResult,
			name: draft.name,
			...(draft.description !== undefined ? { description: draft.description } : {}),
			instancesFolder: draft.instancesFolder,
			titleFieldName: draft.titleFieldName,
			fields: draft.fields,
			createdAt: now,
			updatedAt: now,
		};
		// Steps 5-7: write files.
		const writeResult = await writeTypeFiles(
			`${typesFolder}/${slugResult}.json`,
			`${basesFolder}/${slugResult}.base`,
			schemaPreStamp, now,
		);
		if (writeResult.kind === 'err') return writeResult;
		// Step 8: emit.
		ports.eventBus.emit('make:type-created', { schema: writeResult.value });
		return writeResult;
	}

	const { updateType, retryFailedMoves } = createUpdateTypeOps({
		ports, getSettings, peers, loadType, listTypes, validateSchema, queue,
	});

	async function cascadeInstances(typeId: string): Promise<Result<{ deleted: number; failures: FailedDelete[] }, MakeError>> {
		const list = await peers.listInstances(typeId);
		if (list.kind === 'err') return list;
		const failures: FailedDelete[] = [];
		let deleted = 0;
		for (const ref of list.value) {
			const del = await ports.vault.delete(ref.path);
			if (del.kind === 'err') {
				failures.push({ path: ref.path, cause: String(del.error) });
			} else {
				deleted += 1;
			}
		}
		return ok({ deleted, failures });
	}

	async function maybeDeleteBaseFile(schema: TypeSchema, basesFolder: string): Promise<boolean> {
		if (schema.baseFile === undefined) return false;
		const expectedPrefix = `${basesFolder}/`;
		if (!schema.baseFile.path.startsWith(expectedPrefix)) {
			ports.logger.warn('make', `base file at '${schema.baseFile.path}' lives outside configured basesFolder '${basesFolder}' — not deleted`);
			ports.notifications.info(ports.t.t('make.notify.baseLeftAlone'));
			return false;
		}
		const deleteBase = await ports.vault.delete(schema.baseFile.path);
		if (deleteBase.kind === 'ok') return true;
		ports.notifications.warn(ports.t.t('make.notify.baseDeleteFailed'));
		return false;
	}

	async function deleteType(
		typeId: string,
		options: DeleteTypeOptions,
	): Promise<Result<DeleteTypeReport, MakeError>> {
		const current = await loadType(typeId);
		if (current.kind === 'err') return current;
		const schema = current.value;

		let instancesDeleted = 0;
		let instanceFailures: readonly FailedDelete[] = [];
		if (options.alsoDeleteInstances === true) {
			const cascade = await cascadeInstances(typeId);
			if (cascade.kind === 'err') return cascade;
			instancesDeleted = cascade.value.deleted;
			instanceFailures = cascade.value.failures;
		}

		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const baseFileDeleted = options.alsoDeleteBaseFile === true
			? await maybeDeleteBaseFile(schema, basesFolder)
			: false;

		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const jsonPath = `${typesFolder}/${schema.id}.json`;
		const deleteJson = await ports.vault.delete(jsonPath);
		if (deleteJson.kind === 'err') {
			ports.logger.error('make-service', `deleteType: vault.delete failed for ${jsonPath}`, deleteJson.error);
			return err({ kind: 'vault-error', cause: String(deleteJson.error) });
		}

		ports.eventBus.emit('make:type-deleted', { typeId: schema.id, name: schema.name });
		return ok({ instancesDeleted, instanceFailures, baseFileDeleted });
	}

	async function toggleFavorite(typeId: string): Promise<Result<boolean, MakeError>> {
		const current = getSettings();
		const wasFavorited = current.favorites.includes(typeId);
		const nextFavorites = wasFavorited
			? current.favorites.filter((id) => id !== typeId)
			: [...current.favorites, typeId];
		const saveResult = await ports.settings.saveSection('make', { ...current, favorites: nextFavorites });
		if (saveResult.kind === 'err') {
			ports.logger.error('make-service', `toggleFavorite: settings.saveSection failed`, saveResult.error);
			ports.notifications.warn(ports.t.t('make.error.favoriteFailed'));
			return err({ kind: 'vault-error', cause: saveResult.error });
		}
		const favorited = !wasFavorited;
		ports.eventBus.emit('make:favorite-toggled', { typeId, favorited });
		return ok(favorited);
	}

	return {
		listTypes,
		loadType,
		createType,
		updateType,
		retryFailedMoves,
		deleteType,
		toggleFavorite,
	};
}
